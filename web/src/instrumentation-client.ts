/**
 * Sentry browser-side initialization.
 *
 * Lives at `web/src/instrumentation-client.ts` per the Next.js 15+ convention
 * (works with both webpack and Turbopack). Only loaded in the client bundle —
 * the static-export build of the buyer site has no SSR, so this is the only
 * Sentry surface that runs.
 *
 * DSN is read from NEXT_PUBLIC_SENTRY_DSN (baked at build time). If the env
 * var is empty, Sentry init is skipped — production runs as a no-op until
 * a real DSN is wired through GitHub Actions secrets and web/.env.local.
 *
 * To turn this on:
 *   1. Create a project at sentry.io → copy the DSN
 *   2. Set `NEXT_PUBLIC_SENTRY_DSN` in web/.env.local for local dev
 *   3. Add the same secret in GitHub Actions repo settings, then update
 *      .github/workflows/firebase-hosting-merge.yml to pass it through to
 *      `next build` (mirror the OTP env-var pattern already there).
 */
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Hook called by the App Router on every navigation — lets Sentry trace
// route transitions even when the DSN is unset (no-ops in that case).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // Sample 100% of errors but only 10% of perf transactions in prod.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Replay sessions on errors only — keeps cost low.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Tag every event so Sentry projects can be reused across kkr-groceries
    // environments without manual filtering.
    environment:
      typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "dev"
        : "production",
    beforeSend(event) {
      // Drop noisy 3rd-party errors that aren't actionable for us.
      const message = event.exception?.values?.[0]?.value || "";
      if (message.includes("ResizeObserver loop")) return null;
      if (message.includes("Non-Error promise rejection captured")) return null;
      return event;
    },
  });
}
