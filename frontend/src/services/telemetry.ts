import * as Sentry from "@sentry/nextjs";
import { analytics } from "./analyticsService";

export function captureError(error: Error): void {
  Sentry.captureException(error);
}

export function identifyUser(userId: string): void {
  analytics.identify(userId);
}

export function resetUser(): void {
  analytics.reset();
}
