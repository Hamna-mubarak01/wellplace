import { PAYMENT_CALLBACK } from "@/lib/config/payments";
import { handlePaymentCallback } from "@/lib/services/payment-callback";
import { checkRateLimit } from "@/lib/services/rate-limit";

export const dynamic = "force-dynamic";

function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return `payment-callback:${ip}`;
}

export async function POST(request: Request) {
  const verdict = checkRateLimit(callerKey(request), PAYMENT_CALLBACK.rateLimitPerWindow, PAYMENT_CALLBACK.rateLimitWindowMinutes);
  if (!verdict.allowed) {
    console.warn("[payments] callback rate-limited for", callerKey(request));
    return Response.json({ error: "Too many payment callbacks. Retry shortly." }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (cause) {
    console.error("[payments] callback body could not be read:", cause instanceof Error ? cause.message : cause);
    return Response.json({ error: "The payment callback could not be read." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const provider = request.headers.get(PAYMENT_CALLBACK.providerHeader) ?? new URL(request.url).searchParams.get("provider");
  const outcome = await handlePaymentCallback(rawBody, provider, request.headers.get(PAYMENT_CALLBACK.signatureHeader));

  return outcome.kind === "settled"
    ? Response.json({ status: outcome.settlement.status, duplicate: outcome.settlement.duplicate }, { status: 200, headers: { "Cache-Control": "no-store" } })
    : Response.json({ error: outcome.message }, { status: outcome.status, headers: { "Cache-Control": "no-store" } });
}
