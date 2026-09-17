"use client";
import { CHECKOUT_FLOW } from "@/lib/config/checkout-flow";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { AddonCard } from "@/components/booking/addon-card";
import type { BookingAddonCard } from "@/components/booking/booking-types";
import { formatAed } from "@/components/shared/money";
import { Button } from "@/components/shared/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { clampQuantity, type CartLine } from "@/lib/domain/vouchers";
import { cn } from "@/lib/utils";


const COUNT_VISIBLE_FROM = 0.8;

export interface AddonsStepProps {
  addons: readonly BookingAddonCard[];
  cart: readonly CartLine[];
  quantities: Readonly<Record<string, number>>;
  onQuantitiesChange: (quantities: Readonly<Record<string, number>>) => void;

  personalRequest: string;
  onPersonalRequestChange: (value: string) => void;
  personalRequestMaxLength: number;

  promoCode: string | null;
  onPromoCodeChange: (code: string | null) => void;
  onValidatePromoCode?: (code: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  promoCodesLive: boolean;

  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

function StepSection({
  id,
  title,
  description,
  aside,
  first = false,
  children,
}: {
  id: string;
  title: string;
  description: string;
  aside?: ReactNode;
  first?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={cn(
        "min-w-0",
        !first && "mt-6 border-t border-border pt-6 sm:mt-8 sm:pt-8",
      )}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2
          id={`${id}-heading`}
          className="font-display text-body font-medium text-text-primary"
        >
          {title}
        </h2>
        {aside}
      </div>
      <p
        id={`${id}-description`}
        className="mt-1 text-fine text-pretty text-text-secondary"
      >
        {description}
      </p>
      {children}
    </section>
  );
}

function ListPlaceholder({ children }: { children: ReactNode }) {
  return <div className="mt-4 border-y border-border py-8">{children}</div>;
}

function AddonGrid({
  addons,
  lines,
  onQuantityChange,
}: {
  addons: readonly BookingAddonCard[];
  lines: ReadonlyMap<string, CartLine>;
  onQuantityChange: (id: string, quantity: number) => void;
}) {
  return (
    <ul className="mt-4 min-w-0 divide-y divide-border border-y border-border">
      {addons.map((addon) => (
        <AddonCard
          key={addon.id}
          addon={addon}
          line={lines.get(addon.id) ?? null}
          onQuantityChange={onQuantityChange}
        />
      ))}
    </ul>
  );
}

function PromoCodeField({
  promoCode,
  onPromoCodeChange,
  onValidatePromoCode,
  promoCodesLive,
}: {
  promoCode: string | null;
  onPromoCodeChange: (code: string | null) => void;
  onValidatePromoCode?: (code: string) => Promise<{ ok: true } | { ok: false; message: string }>;
  promoCodesLive: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const add = async () => {
    const code = draft.trim();
    if (code === "") {
      setError("Enter a promotional code, or continue without one.");
      return;
    }
    if (checkingRef.current) return;
    if (onValidatePromoCode) {
      checkingRef.current = true;
      setChecking(true);
      try {
        const verdict = await onValidatePromoCode(code);
        if (!verdict.ok) {
          setError(null);
          setDraft("");
          toast.error(verdict.message);
          inputRef.current?.focus();
          return;
        }
      } finally {
        checkingRef.current = false;
        setChecking(false);
      }
    }
    setError(null);
    setDraft("");
    onPromoCodeChange(code);
  };

  if (promoCode !== null) {
    return (
      <>
        <div className="mt-4 flex min-h-tap items-center justify-between gap-4 border-y border-border py-3">
          <span className="min-w-0">
            <span className="block truncate font-data text-body text-text-primary">
              {promoCode}
            </span>
            <span className="mt-0.5 block text-fine text-pretty text-text-secondary">
              Your price includes eligible discounts once the code is checked.
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onPromoCodeChange(null)}
            aria-label={`Remove promotional code ${promoCode}`}
            className="h-tap shrink-0 rounded-(--radius-control) px-4 text-control font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          >
            Remove
          </Button>
        </div>

        {!promoCodesLive ? <PromoNotLiveNotice /> : null}
      </>
    );
  }

  return (
    <>
      <Field
        className="mt-4 gap-1.5"
        data-invalid={Boolean(error) || undefined}
      >
        <FieldLabel htmlFor="book-promo-code" className="sr-only">
          Promotional code
        </FieldLabel>
        <div className="flex items-start gap-2">
          <Input
            ref={inputRef}
            id="book-promo-code"
            maxLength={CHECKOUT_FLOW.codeLength}
            value={draft}
            placeholder="Enter your code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void add();
              }
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "book-promo-code-error" : undefined}
            className="h-control min-w-0 flex-1 rounded-(--radius-card) bg-surface-raised px-4 font-data text-control"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void add()}
            disabled={checking}
            className="h-control shrink-0 rounded-(--radius-card) border-border bg-surface-raised px-4 text-control font-medium text-text-primary hover:border-brand hover:bg-surface-hover"
          >
            {checking ? "Checking…" : "Add code"}
          </Button>
        </div>
        {error ? (
          <FieldError id="book-promo-code-error" className="text-micro font-medium">
            {error}
          </FieldError>
        ) : null}
      </Field>

      {!promoCodesLive ? <PromoNotLiveNotice /> : null}
    </>
  );
}

function PromoNotLiveNotice() {
  return (
    <p className="mt-3 text-fine font-medium text-pretty text-warning">
      Codes cannot be checked yet — WellPlace has not supplied any, and payment
      is not connected. Nothing has come off the price shown beside this step.
    </p>
  );
}

export function AddonsStep({
  addons,
  cart,
  quantities,
  onQuantitiesChange,
  personalRequest,
  onPersonalRequestChange,
  personalRequestMaxLength,
  promoCode,
  onPromoCodeChange,
  onValidatePromoCode,
  promoCodesLive,
  loading = false,
  error = null,
  onRetry,
  className,
}: AddonsStepProps) {
  const lines = useMemo(
    () => new Map(cart.map((line) => [line.id, line])),
    [cart],
  );

  const setQuantity = (id: string, quantity: number) => {
    const addon = addons.find((entry) => entry.id === id);
    if (addon === undefined) return;
    const next = quantity <= 0 ? 0 : clampQuantity(addon, quantity);
    onQuantitiesChange({ ...quantities, [id]: next });
  };

  const settled = !loading && error === null;
  const hasList = settled && addons.length > 0;

  const used = personalRequest.length;
  const remaining = Math.max(0, personalRequestMaxLength - used);
  const showCount = used >= Math.floor(personalRequestMaxLength * COUNT_VISIBLE_FROM);

  return (
    <div className={cn("min-w-0", className)}>
      <StepSection
        first
        id="book-addons"
        title="Add-ons"
        aside={<output aria-label="Extras total" aria-live="polite" className="font-data text-fine text-text-primary">{formatAed(cart.reduce((total, line) => total + line.quantity * line.unitPriceFils, 0))}</output>}
        description="Optional. Everything here is prepared before you arrive."
      >
        {loading ? (
          <>
            <p className="sr-only" role="status">
              Loading add-ons
            </p>
            <ul aria-hidden className="mt-4 min-w-0 divide-y divide-border border-y border-border">
              {[0, 1, 2].map((row) => (
                <li key={row} className="flex min-w-0 items-center gap-4 py-3">
                  <Skeleton className="size-18 shrink-0 rounded-(--radius-control) sm:size-20" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-56 max-w-full" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-tap w-20 shrink-0 rounded-(--radius-card)" />
                </li>
              ))}
            </ul>
          </>
        ) : error !== null ? (
          <ListPlaceholder>
            <p role="alert" className="text-body font-medium text-pretty text-danger">
              We could not load the add-ons.
            </p>
            <p className="mt-1 text-fine text-pretty text-text-secondary">
              {error}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {onRetry ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onRetry}
                  className="h-control rounded-(--radius-card) border-border bg-surface-raised px-4 text-control font-medium text-text-primary hover:border-brand hover:bg-surface-hover"
                >
                  Try again
                </Button>
              ) : null}
              <p className="text-fine text-pretty text-text-secondary">
                You can continue without extras. Nothing you have entered is
                lost.
              </p>
            </div>
          </ListPlaceholder>
        ) : addons.length === 0 ? (
          <ListPlaceholder>
            <p className="text-body text-pretty text-text-primary">
              There are no extras to add to this session.
            </p>
            <p className="mt-1 text-fine text-pretty text-text-secondary">
              Tell us anything you would like ready in the suite below, then
              continue.
            </p>
          </ListPlaceholder>
        ) : (
          <AddonGrid
            addons={addons}
            lines={lines}
            onQuantityChange={setQuantity}
          />
        )}

        {hasList ? (
          <p className="mt-5 text-fine text-pretty text-text-secondary">
            You can change these at any point before you pay. Changing the
            number of guests never changes what you have added here.
          </p>
        ) : null}
      </StepSection>

      <StepSection
        id="book-request"
        title="Anything we should know?"
        description="Optional. An occasion, an allergy, or something you would like ready in the suite."
        aside={
          showCount ? (
            <span className="shrink-0 font-data text-fine tabular-nums text-text-secondary">
              {remaining} left
              <span className="sr-only"> characters</span>
            </span>
          ) : null
        }
      >
        <Textarea
          id="book-personal-request"
          value={personalRequest}
          maxLength={personalRequestMaxLength}
          placeholder="For example: we are celebrating a birthday."
          onChange={(event) =>
            onPersonalRequestChange(
              event.target.value.slice(0, personalRequestMaxLength),
            )
          }
          aria-describedby={cn(
            "book-request-description",
            showCount && "book-request-count",
          )}
          className="mt-4 min-h-32 w-full rounded-(--radius-card) bg-surface-raised px-4 py-3 text-body text-text-primary placeholder:text-text-muted"
        />
        {showCount ? (
          <span id="book-request-count" className="sr-only">
            {remaining} characters left of {personalRequestMaxLength}.
          </span>
        ) : null}
      </StepSection>

      <StepSection
        id="book-promo"
        title="Promotional code"
        description="Optional. Your price updates when you apply a valid code."
      >
        <PromoCodeField
          promoCode={promoCode}
          onPromoCodeChange={onPromoCodeChange}
          onValidatePromoCode={onValidatePromoCode}
          promoCodesLive={promoCodesLive}
        />
      </StepSection>
    </div>
  );
}
