export async function pingHeartbeat(name: string): Promise<void> {
  const envKey = `BETTERUPTIME_HEARTBEAT_${name.toUpperCase()}`;
  const url = process.env[envKey];
  if (!url) return;
  try {
    await fetch(url, { method: "GET" });
  } catch {
    // heartbeat failure must never affect app logic
  }
}
