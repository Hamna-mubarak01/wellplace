import type { Instrumentation } from "next";

const DSN = process.env.SENTRY_DSN;
const ENV = process.env.NEXT_PUBLIC_APP_ENV ?? "development";

export async function register(): Promise<void> {
  if (!DSN) return;

  const Sentry = await import("@sentry/nextjs");

  Sentry.init({
    dsn: DSN,
    environment: ENV,

    sendDefaultPii: false,

    enabled: ENV === "production",

    tracesSampleRate: ENV === "production" ? 0.1 : 0,

    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers.apikey;
        }
      }
      return event;
    },
  });
}

export const onRequestError: Instrumentation.onRequestError = async (
  err,
  request,
  context,
) => {
  if (!DSN) {
    console.error("[instrumentation] request error:", err);
    return;
  }
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, context);
};
