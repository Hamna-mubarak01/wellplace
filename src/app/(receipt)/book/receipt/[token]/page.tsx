import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CircleAlertIcon, CircleCheckIcon, CircleXIcon, RotateCcwIcon } from "lucide-react";
import { z } from "zod";
import { guestReceipt } from "@/lib/db/guest-checkout";
import {
  RECEIPT_COPY,
  RECEIPT_LINK,
  receiptDocumentPath,
  receiptSchema,
  type GuestReceipt,
} from "@/lib/config/receipt";
import { receiptView, type ReceiptRow, type ReceiptTone } from "@/lib/documents/receipt-view";
import { formatAed } from "@/components/shared/money";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/shared/button";
import { Wordmark } from "@/components/shared/wordmark";
import { ReceiptActions } from "@/components/booking/receipt-actions";
import { ReceiptCelebration } from "@/components/booking/receipt-celebration";
import { todayInDubai } from "@/lib/domain/time";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Booking receipt",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};

async function loadReceipt(token: string) {
  try {
    return await guestReceipt(token);
  } catch (error) {
    console.error("[receipt] failed to load guest receipt:", error);
    throw error;
  }
}

function parseReceipt(raw: unknown): GuestReceipt {
  try {
    return receiptSchema.parse(raw);
  } catch (error) {
    console.error("[receipt] failed to parse guest receipt:", error);
    throw error;
  }
}

const STATUS_ICON: Record<ReceiptTone, { Icon: typeof CircleCheckIcon; className: string }> = {
  confirmed: { Icon: CircleCheckIcon, className: "border-success-border bg-success-wash text-success-ink" },
  cancelled: { Icon: CircleXIcon, className: "border-border-strong bg-surface-sunken text-text-secondary" },
  refunded: { Icon: RotateCcwIcon, className: "border-warning-border bg-warning-wash text-warning-ink" },
};

function FactList({ heading, rows }: { heading: string; rows: readonly ReceiptRow[] }) {
  return (
    <section className="min-w-0">
      <h2 className="text-label tracking-label text-text-muted uppercase">{heading}</h2>
      <dl className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2.5">
            <dt className="text-small text-text-secondary">{row.label}</dt>
            <dd className="min-w-0 text-right text-small font-medium break-words text-text-primary">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  if (!z.uuid().safeParse(token).success) notFound();
  const raw = await loadReceipt(token);
  if (!raw) notFound();
  const receipt = parseReceipt(raw);
  const view = receiptView(receipt);
  const celebrate = (await searchParams)[RECEIPT_LINK.celebrateParam] !== undefined && view.tone === "confirmed";
  const status = STATUS_ICON[view.tone];

  return (
    <div className="receipt-backdrop relative isolate flex min-h-dvh flex-col">
      {celebrate && <ReceiptCelebration />}

      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 pt-5 sm:pt-8 print:hidden">
        <Button asChild variant="ghost" hoverEffect="sweep" className="h-tap gap-2 px-3">
          <Link href="/book">
            <ArrowLeftIcon aria-hidden="true" className="size-4" />
            Back to booking
          </Link>
        </Button>
        <Link href="/" aria-label="WellPlace home" className="rounded-(--radius-control) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          <Wordmark height={22} />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pt-8 pb-16 sm:gap-8 sm:pt-12">
        <section className="flex flex-col items-center gap-3 text-center">
          <span className={cn("grid size-16 place-items-center rounded-full border shadow-(--shadow-md)", status.className)}>
            <status.Icon aria-hidden="true" className="size-8" />
          </span>
          <p className="text-label tracking-label text-text-secondary uppercase">Booking {view.reference}</p>
          <h1 className="font-display text-h1 text-balance text-text-primary">{view.heading}</h1>
          <p className="text-body text-pretty text-text-secondary">
            <span className="font-medium text-text-primary">{view.visitDate}</span>
            <span aria-hidden="true"> · </span>
            <span className="whitespace-nowrap">{view.visitTime}</span>
            <span className="text-text-muted"> (Dubai time)</span>
          </p>
          {view.tone === "confirmed" && (
            <p className="text-small text-pretty text-text-secondary">
              A confirmation is on its way to <span className="font-medium break-all text-text-primary">{view.email}</span>.
            </p>
          )}
        </section>

        {view.notice !== null && (
          <Alert role="status" className="border-warning-border bg-warning-wash text-warning-ink">
            <CircleAlertIcon aria-hidden="true" />
            <AlertTitle>We could not keep this booking</AlertTitle>
            <AlertDescription className="text-current">{view.notice}</AlertDescription>
          </Alert>
        )}

        <Card className="gap-0 overflow-hidden rounded-(--radius-modal) border border-border bg-surface-raised py-0 shadow-(--shadow-lg)">
          <div aria-hidden="true" className="h-1 w-full bg-brand" />
          <CardContent className="flex flex-col gap-8 p-5 sm:p-8">
            <div className="grid gap-8 sm:grid-cols-2">
              <FactList heading="Your visit" rows={view.visit} />
              <FactList
                heading="Guest and payment"
                rows={[
                  { key: "name", label: "Name", value: view.guestName },
                  { key: "email", label: "Email", value: view.email },
                  ...view.payment,
                ]}
              />
            </div>

            <Separator />

            <section aria-labelledby="receipt-price" className="flex flex-col gap-3">
              <h2 id="receipt-price" className="text-label tracking-label text-text-muted uppercase">Price</h2>
              <ul className="divide-y divide-border">
                {view.lines.map((line) => (
                  <li key={line.key} className="flex justify-between gap-4 py-2.5 text-small">
                    <span className="min-w-0 text-text-primary">{line.label}</span>
                    <span className="font-data whitespace-nowrap tabular-nums text-text-primary">{line.value}</span>
                  </li>
                ))}
              </ul>
              <dl className="ml-auto flex w-full max-w-xs flex-col gap-1.5">
                {view.totals.map((total) => (
                  <div
                    key={total.key}
                    className={cn(
                      "flex justify-between gap-4",
                      total.emphasis && "mt-2 border-t border-border-strong pt-3",
                    )}
                  >
                    <dt className={cn(total.emphasis ? "text-body font-semibold text-text-primary" : "text-small text-text-secondary")}>{total.label}</dt>
                    <dd
                      className={cn(
                        "font-data whitespace-nowrap tabular-nums",
                        total.emphasis ? "text-h3 font-semibold text-text-primary" : "text-small text-text-primary",
                        total.struck && "text-text-muted line-through",
                      )}
                    >
                      {total.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            {view.refunds.length > 0 && (
              <>
                <Separator />
                <section aria-labelledby="receipt-refunds" className="flex flex-col gap-3">
                  <h2 id="receipt-refunds" className="text-label tracking-label text-text-muted uppercase">Refunds</h2>
                  <ul className="divide-y divide-border">
                    {view.refunds.map((refund) => (
                      <li key={refund.key} className="flex flex-wrap justify-between gap-x-4 gap-y-1 py-2.5 text-small">
                        <span className="text-text-secondary">{refund.label}</span>
                        <span className="font-data tabular-nums text-text-primary">{refund.value}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}

            {receipt.documents.length > 0 && (
              <>
                <Separator />
                <section aria-labelledby="tax-documents" className="flex flex-col gap-3">
                  <h2 id="tax-documents" className="text-label tracking-label text-text-muted uppercase">
                    {RECEIPT_COPY.documents.heading}
                  </h2>
                  <ul className="divide-y divide-border">
                    {receipt.documents.map((document) => (
                      <li key={document.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-3">
                        <div className="min-w-0 space-y-1">
                          <p className="text-small text-text-primary">
                            {RECEIPT_COPY.documents.typeLabel[document.type]}{" "}
                            <span className="font-data break-all">{document.number}</span>
                          </p>
                          <p className="text-micro text-text-secondary">
                            {todayInDubai(new Date(document.issuedAt))} ·{" "}
                            <span className="font-data whitespace-nowrap">{formatAed(document.totalFils)}</span>
                            {document.invoiceNumber && (
                              <>
                                {" · "}
                                {RECEIPT_COPY.documents.credits.replace("{number}", document.invoiceNumber)}
                              </>
                            )}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={receiptDocumentPath(token, document.id)} download>
                            {RECEIPT_COPY.documents.download}
                            <span className="sr-only"> {document.number}</span>
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              </>
            )}
          </CardContent>
        </Card>

        <ReceiptActions token={token} reference={view.reference} />

        {view.tone === "refunded" && (
          <Button asChild className="h-control w-full">
            <Link href="/book">Choose a new visit</Link>
          </Button>
        )}

        {view.simulated && (
          <p className="text-center text-micro text-text-muted">Test payment: no money was charged. This receipt is not a tax invoice.</p>
        )}
      </main>
    </div>
  );
}
