import * as Sentry from "@sentry/node";
import { PostHog } from "posthog-node";

let posthog: PostHog | null = null;

export function initTelemetry(): void {
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV ?? "development",
      tracesSampleRate: 0.1,
      enabled: process.env.NODE_ENV !== "development",
      integrations: [
        Sentry.expressIntegration(),
        Sentry.httpIntegration(),
      ],
    });
    console.log("[Sentry] Initialized");
  }

  const posthogKey = process.env.POSTHOG_API_KEY;
  const posthogHost = process.env.POSTHOG_HOST;
  if (posthogKey) {
    posthog = new PostHog(posthogKey, {
      host: posthogHost ?? "https://app.posthog.com",
    });
    console.log("[PostHog] Initialized");
  }
}

export { Sentry };

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
  distinctId?: string
): void {
  if (!posthog) return;
  posthog.capture({
    distinctId: distinctId ?? "anonymous",
    event,
    properties,
  });
}

export function captureError(error: Error): void {
  Sentry.captureException(error);
}
