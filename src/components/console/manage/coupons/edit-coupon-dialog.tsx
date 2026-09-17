"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveCoupon } from "@/app/(console)/manage/coupons/actions";
import { COUPON_LIMITS, couponSchema, type CouponRow } from "@/lib/config/coupons";
import { toast } from "@/lib/console/feedback";
import { CouponTermsFields } from "@/components/console/manage/coupons/coupon-terms-fields";
import {
  templateFromTerms,
  termsFieldForPath,
  termsFromCoupon,
  type CouponAddonChoices,
  type CouponTermsDraft,
  type CouponTermsField,
} from "@/components/console/manage/coupons/coupon-terms-model";
import { Input } from "@/components/console/reception/reception-input";
import { Button } from "@/components/shared/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";

export interface EditCouponDialogProps {
  coupon: CouponRow;
  addons: CouponAddonChoices;
  onClose: () => void;
}

type EditField = CouponTermsField | "code";

function usageSummary(coupon: CouponRow): string {
  const used =
    coupon.usedCount === 0
      ? "Not used yet"
      : coupon.usedCount === 1
        ? "Used once"
        : `Used ${coupon.usedCount.toLocaleString("en-AE")} times`;
  return coupon.batchName === null ? used : `${used} · Batch: ${coupon.batchName}`;
}

export function EditCouponDialog({ coupon, addons, onClose }: EditCouponDialogProps) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [code, setCode] = useState(coupon.code);
  const [terms, setTerms] = useState<CouponTermsDraft>(() => termsFromCoupon(coupon));
  const [invalid, setInvalid] = useState<EditField | null>(null);

  const renamed = code.trim().toUpperCase() !== coupon.code;

  const updateTerms = (patch: Partial<CouponTermsDraft>) => {
    setTerms((current) => ({ ...current, ...patch }));
    setInvalid(null);
  };

  const submit = () => {
    if (pending) return;
    const parsed = couponSchema.safeParse({
      id: coupon.id,
      updatedAt: coupon.updatedAt,
      code,
      ...templateFromTerms(terms),
    });
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      setInvalid(issue.path[0] === "code" ? "code" : termsFieldForPath(issue.path[0]));
      toast.error("The coupon was not saved", { description: issue.message });
      return;
    }

    start(async () => {
      try {
        const result = await saveCoupon(parsed.data);
        if (!result.ok) {
          toast.error("The coupon was not saved", { description: result.message });
          return;
        }
        toast.success("Coupon saved");
        onClose();
        router.refresh();
      } catch (cause) {
        console.error("[coupons] save did not respond", cause);
        toast.error("Check whether the coupon was saved", {
          description: "The connection was interrupted. Reload the coupon list before saving again.",
        });
      }
    });
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent className="flex max-h-dialog-max-h min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 text-left">
          <DialogTitle>Edit coupon</DialogTitle>
          <DialogDescription className="text-console-body text-text-secondary">{usageSummary(coupon)}</DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
            <fieldset disabled={pending} className="flex min-w-0 flex-col gap-4">
              <Field data-invalid={invalid === "code" || undefined}>
                <FieldLabel htmlFor={`${id}-code`}>Code</FieldLabel>
                <Input
                  id={`${id}-code`}
                  value={code}
                  maxLength={COUPON_LIMITS.codeMax}
                  autoComplete="off"
                  spellCheck={false}
                  disabled={pending}
                  aria-invalid={invalid === "code" || undefined}
                  aria-describedby={renamed ? `${id}-renamed` : undefined}
                  className="font-data"
                  onChange={(event) => {
                    setCode(event.target.value.toUpperCase());
                    setInvalid(null);
                  }}
                />
                {renamed && (
                  <p id={`${id}-renamed`} className="text-micro text-pretty text-text-secondary">
                    Once saved, <span className="font-data">{coupon.code}</span> stops working, including in
                    links already shared.
                  </p>
                )}
              </Field>

              <CouponTermsFields
                terms={terms}
                onChange={updateTerms}
                addons={addons}
                disabled={pending}
                invalid={invalid === "code" ? null : invalid}
              />
            </fieldset>
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-surface-raised p-4">
            <Button type="button" variant="ghost" hoverEffect="sweep" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
