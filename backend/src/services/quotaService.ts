import { prisma } from "../lib/prisma";
import { cacheGet, cacheSet } from "./cacheService";

prisma.$use(async (params, next) => {
  const MAX_RETRIES = 2;
  let attempt = 0;
  while (true) {
    try {
      return await next(params);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      const isConnectionError =
        message.includes("Can't reach database server") ||
        message.includes("Connection refused") ||
        message.includes("ETIMEDOUT") ||
        message.includes("ECONNRESET");

      if (isConnectionError && attempt < MAX_RETRIES) {
        attempt++;
        const delay = attempt * 1000;
        console.warn(
          `[Prisma] Connection failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw err;
    }
  }
});

export const COSTS = {
  search: 100,
  videoDetails: 1,
} as const;

export const THRESHOLDS = {
  WARNING: 7000,
  RESTRICTED: 9000,
  EMERGENCY: 9800,
  MAX: 10000,
} as const;

const HOURLY_BUDGET: Record<number, number> = {
  0: 150,  1: 100,  2: 100,  3: 100,  4: 100,  5: 150,
  6: 400,  7: 500,  8: 600,  9: 600,  10: 600, 11: 600,
  12: 600, 13: 600, 14: 600, 15: 600, 16: 600, 17: 600,
  18: 600, 19: 600, 20: 600, 21: 500, 22: 400, 23: 300,
};

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function getHourKey(): string {
  const now = new Date();
  return `quota:hourly:${now.toISOString().slice(0, 13)}`;
}

async function getHourlyUsage(): Promise<number> {
  const cached = await cacheGet<number>(getHourKey());
  return cached ?? 0;
}

async function incrementHourlyUsage(cost: number): Promise<void> {
  const key = getHourKey();
  const current = await getHourlyUsage();
  await cacheSet(key, current + cost, 3600);
}

async function ensureTodayRecord() {
  const today = getTodayString();
  const existing = await prisma.apiQuota.findUnique({ where: { date: today } });
  if (existing) return existing;

  try {
    return await prisma.apiQuota.create({ data: { date: today, units: 0 } });
  } catch {
    const retry = await prisma.apiQuota.findUnique({ where: { date: today } });
    if (retry) return retry;
    throw new Error("Failed to create or find today's quota record");
  }
}

export async function canMakeCall(cost: number): Promise<boolean> {
  const record = await ensureTodayRecord();
  const dailyOk = record.units + cost <= THRESHOLDS.MAX;

  const hour = new Date().getHours();
  const hourlyBudget = HOURLY_BUDGET[hour] ?? 600;
  const hourlyUsed = await getHourlyUsage();
  const hourlyOk = hourlyUsed + cost <= hourlyBudget;

  return dailyOk && hourlyOk;
}

export async function recordCall(cost: number): Promise<void> {
  await ensureTodayRecord();
  const today = getTodayString();
  const result = await prisma.apiQuota.update({
    where: { date: today },
    data: { units: { increment: cost } },
  });

  await incrementHourlyUsage(cost);
  await checkAndAlert(result.units);
}

export type QuotaStatus = "normal" | "warning" | "restricted" | "emergency";

export function getStatus(units: number): QuotaStatus {
  if (units >= THRESHOLDS.EMERGENCY) return "emergency";
  if (units >= THRESHOLDS.RESTRICTED) return "restricted";
  if (units >= THRESHOLDS.WARNING) return "warning";
  return "normal";
}

export async function getTodayQuota(): Promise<{
  date: string;
  units: number;
  status: QuotaStatus;
  max: number;
  thresholds: typeof THRESHOLDS;
  hourlyBudget: number;
  hourlyUsed: number;
}> {
  const record = await ensureTodayRecord();
  const hour = new Date().getHours();

  return {
    date: record.date,
    units: record.units,
    status: getStatus(record.units),
    max: THRESHOLDS.MAX,
    thresholds: THRESHOLDS,
    hourlyBudget: HOURLY_BUDGET[hour] ?? 600,
    hourlyUsed: await getHourlyUsage(),
  };
}

const ALERT_THRESHOLDS = [7000, 8500, 9500];
const alertedToday = new Set<number>();
let lastAlertDate = "";

async function checkAndAlert(currentUsage: number): Promise<void> {
  const today = getTodayString();
  if (lastAlertDate !== today) {
    alertedToday.clear();
    lastAlertDate = today;
  }

  for (const threshold of ALERT_THRESHOLDS) {
    if (currentUsage >= threshold && !alertedToday.has(threshold)) {
      alertedToday.add(threshold);
      await sendQuotaAlert(threshold, currentUsage);
    }
  }
}

async function sendQuotaAlert(threshold: number, current: number): Promise<void> {
  const pct = Math.round((current / THRESHOLDS.MAX) * 100);
  const message = `[QUOTA ALERT] ${current}/${THRESHOLDS.MAX} units used today (${pct}%) — ${threshold} threshold crossed`;
  console.error(message);

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
    } catch {
      // alert failure must never crash the app
    }
  }
}

export { prisma };
