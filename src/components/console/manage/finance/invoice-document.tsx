import { ConsoleCard } from "@/components/console/console-surface";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INVOICE_COPY } from "@/lib/config/invoice";
import type { InvoiceDocument as InvoiceDocumentView } from "@/lib/messaging/templates/invoice";
import { cn } from "@/lib/utils";

const LABEL = INVOICE_COPY.labels;
const PDF = INVOICE_COPY.pdf;

const HEAD = "h-11 text-console-label font-medium tracking-label text-text-muted uppercase";
const NUMBER_CELL = "px-3 py-3 text-right font-data tabular-nums text-text-secondary";

export interface InvoiceDocumentProps {
  document: InvoiceDocumentView;
  className?: string;
}

export function InvoiceDocument({ document, className }: InvoiceDocumentProps) {
  return (
    <ConsoleCard className={cn("min-w-0", className)}>
      <article
        aria-label={`${document.title} ${document.number}`}
        className="@container flex min-w-0 flex-col gap-6 px-5 py-6 sm:px-8 sm:py-8"
      >
        {document.testNotice && (
          <p
            role="note"
            className="rounded-(--radius-card) border border-warning-border bg-warning-wash px-4 py-3 text-console-body font-semibold text-warning-ink"
          >
            {document.testNotice}
          </p>
        )}

        <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-console-label tracking-label text-text-muted uppercase">{document.tradingName}</p>
            <h2 className="font-display text-h2 font-bold text-text-primary">{document.title}</h2>
          </div>
          <dl className="grid min-w-0 gap-2 text-console-body">
            {document.facts.map((fact) => (
              <div key={fact.label} className="grid grid-cols-1 gap-x-4 @md:grid-cols-2">
                <dt className="text-text-muted">{fact.label}</dt>
                <dd className="min-w-0 font-data tabular-nums break-words text-text-primary">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {document.voided && (
          <p
            role="note"
            className="rounded-(--radius-card) border border-danger-border bg-danger-wash px-4 py-3 text-console-body text-danger-ink"
          >
            <span className="font-semibold uppercase">{INVOICE_COPY.voidStamp}</span>
            {` · ${LABEL.voidedOn} ${document.voided.on}`}
            {document.voided.reason ? ` · ${LABEL.voidReason}: ${document.voided.reason}` : ""}
          </p>
        )}

        <div className="grid min-w-0 gap-6 border-b border-border pb-6 @2xl:grid-cols-2">
          <section aria-labelledby="invoice-issuer" className="flex min-w-0 flex-col gap-1 text-console-body">
            <h3 id="invoice-issuer" className="text-console-label tracking-label text-text-muted uppercase">
              {LABEL.issuer}
            </h3>
            <p className="font-medium break-words text-text-primary">{document.issuer.legalName}</p>
            <p className="font-data tabular-nums text-text-secondary">
              {LABEL.trn} {document.issuer.trn}
            </p>
            {document.issuer.addressLines.map((line, index) => (
              <p key={`${index}-${line}`} className="break-words text-text-secondary">
                {line}
              </p>
            ))}
          </section>

          <section aria-labelledby="invoice-bill-to" className="flex min-w-0 flex-col gap-1 text-console-body">
            <h3 id="invoice-bill-to" className="text-console-label tracking-label text-text-muted uppercase">
              {LABEL.billTo}
            </h3>
            <p className="font-medium break-words text-text-primary">{document.billTo.name}</p>
            {document.billTo.company && <p className="break-words text-text-primary">{document.billTo.company}</p>}
            {document.billTo.trn && (
              <p className="font-data tabular-nums text-text-secondary">
                {LABEL.trn} {document.billTo.trn}
              </p>
            )}
            {document.billTo.addressLines.map((line, index) => (
              <p key={`${index}-${line}`} className="break-words text-text-secondary">
                {line}
              </p>
            ))}
            <p className="break-all text-text-secondary">{document.billTo.email}</p>
            <p className="font-data tabular-nums text-text-secondary">{document.billTo.phone}</p>
          </section>
        </div>

        <Table className="text-console-table">
          <TableCaption className="sr-only">{`${document.title} ${document.number}`}</TableCaption>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead scope="col" className={cn(HEAD, "px-0")}>
                {LABEL.description}
              </TableHead>
              <TableHead scope="col" className={cn(HEAD, "px-3 text-right")}>
                {LABEL.quantity}
              </TableHead>
              <TableHead scope="col" className={cn(HEAD, "px-3 text-right")}>
                {LABEL.unitPrice}
              </TableHead>
              <TableHead scope="col" className={cn(HEAD, "px-3 text-right")}>
                {PDF.vatRate}
              </TableHead>
              <TableHead scope="col" className={cn(HEAD, "px-3 text-right")}>
                {PDF.vat}
              </TableHead>
              <TableHead scope="col" className={cn(HEAD, "px-0 text-right")}>
                {LABEL.amount}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {document.lines.map((line) => (
              <TableRow key={line.key} className="border-border hover:bg-transparent">
                <TableCell className="px-0 py-3 whitespace-normal text-text-primary">
                  <span className="block font-medium">{line.description}</span>
                  {line.detail && <span className="block text-micro text-text-secondary">{line.detail}</span>}
                </TableCell>
                <TableCell className={NUMBER_CELL}>{line.quantity ?? ""}</TableCell>
                <TableCell className={NUMBER_CELL}>{line.unitPrice ?? ""}</TableCell>
                <TableCell className={NUMBER_CELL}>{line.vatRate ?? ""}</TableCell>
                <TableCell className={NUMBER_CELL}>{line.vat ?? ""}</TableCell>
                <TableCell className="px-0 py-3 text-right font-data tabular-nums text-text-primary">
                  {line.amount}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <dl className="ml-auto grid w-full max-w-md gap-2 text-console-body">
          {document.totals.map((total) => (
            <div
              key={total.key}
              className={cn(
                "flex items-baseline justify-between gap-4",
                total.emphasis && "border-t border-border-strong pt-3 font-semibold",
              )}
            >
              <dt className={total.emphasis ? "text-text-primary" : "text-text-secondary"}>{total.label}</dt>
              <dd className="font-data tabular-nums whitespace-nowrap text-text-primary">{total.value}</dd>
            </div>
          ))}
        </dl>

        {document.payments.length > 0 && (
          <section aria-labelledby="invoice-payments" className="flex min-w-0 flex-col gap-2 border-t border-border pt-6">
            <h3 id="invoice-payments" className="text-console-label tracking-label text-text-muted uppercase">
              {PDF.payments}
            </h3>
            <Table className="text-console-table">
              <TableCaption className="sr-only">{PDF.payments}</TableCaption>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead scope="col" className={cn(HEAD, "px-0")}>
                    {PDF.paidOn}
                  </TableHead>
                  <TableHead scope="col" className={cn(HEAD, "px-3")}>
                    {PDF.method}
                  </TableHead>
                  <TableHead scope="col" className={cn(HEAD, "px-3")}>
                    {PDF.paymentNumber}
                  </TableHead>
                  <TableHead scope="col" className={cn(HEAD, "px-3")}>
                    {PDF.providerReference}
                  </TableHead>
                  <TableHead scope="col" className={cn(HEAD, "px-0 text-right")}>
                    {LABEL.amount}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {document.payments.map((payment) => (
                  <TableRow key={payment.key} className="border-border hover:bg-transparent">
                    <TableCell className="px-0 py-3 whitespace-nowrap text-text-primary">{payment.date}</TableCell>
                    <TableCell className="px-3 py-3 text-text-primary">{payment.method}</TableCell>
                    <TableCell className="px-3 py-3 font-data tabular-nums text-text-secondary">{payment.reference ?? ""}</TableCell>
                    <TableCell className="px-3 py-3 font-data tabular-nums break-all whitespace-normal text-text-secondary">
                      {payment.providerReference ?? ""}
                    </TableCell>
                    <TableCell className="px-0 py-3 text-right font-data tabular-nums text-text-primary">
                      {payment.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        <p className="text-micro text-text-muted">{document.currencyNote}</p>
      </article>
    </ConsoleCard>
  );
}
