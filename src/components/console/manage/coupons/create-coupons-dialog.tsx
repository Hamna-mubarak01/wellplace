"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { generateCouponBatch } from "@/app/(console)/manage/coupons/actions";
import { COUPON_GENERATION } from "@/lib/config/coupons";
import { toast } from "@/lib/console/feedback";
import {
  CouponChoiceGroup,
  type CouponChoiceOption,
} from "@/components/console/manage/coupons/coupon-choice-group";
import {
  COUPON_COUNT_MESSAGE,
  NEW_COUPON_BATCH,
  createLabel,
  planCouponBatch,
  previewUses,
  type CouponCreateDraft,
  type CouponCreateField,
  type CouponNaming,
  type CouponQuantity,
  type CreatedCouponBatch,
} from "@/components/console/manage/coupons/coupon-create-model";
import { CouponOwnCodeFields } from "@/components/console/manage/coupons/coupon-own-code-fields";
import { CouponRandomCodeFields } from "@/components/console/manage/coupons/coupon-random-code-fields";
import { CouponTermsFields } from "@/components/console/manage/coupons/coupon-terms-fields";
import {
  previewRequestFromTerms,
  type CouponAddonChoices,
  type CouponTermsDraft,
  type CouponTermsField,
} from "@/components/console/manage/coupons/coupon-terms-model";
import { CreatedCouponsView } from "@/components/console/manage/coupons/created-coupons-view";
import { ExpectedIncomePanel } from "@/components/console/manage/coupons/expected-income-panel";
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
import { Separator } from "@/components/ui/separator";

export interface CreateCouponsDialogProps {
  open: boolean;
  addons: CouponAddonChoices;
  onClose: () => void;
}

const QUANTITY_OPTIONS: readonly CouponChoiceOption<CouponQuantity>[] = [
  { value: "single", label: "Single coupon" },
  { value: "several", label: "Several coupons" },
];

const NAMING_OPTIONS: readonly CouponChoiceOption<CouponNaming>[] = [
  { value: "random", label: "Random" },
  { value: "list", label: "My own names" },
];

const SECTION_HEADING_CLASS = "text-console-body font-semibold text-text-primary";

const HIGHLIGHTED_TERMS: readonly CouponTermsField[] = ["value", "validTo", "maxUses", "perCustomerLimit"];

function highlightedTerm(field: CouponCreateField | null, terms: CouponTermsDraft): CouponTermsField | null {
  const match = HIGHLIGHTED_TERMS.find((candidate) => candidate === field) ?? null;
  if (match === "value" && terms.value.trim() === "") return null;
  return match;
}

export function CreateCouponsDialog({ open, addons, onClose }: CreateCouponsDialogProps) {
  const router = useRouter();
  const formId = useId();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<CouponCreateDraft>(NEW_COUPON_BATCH);
  const [conflicts, setConflicts] = useState<readonly string[]>([]);
  const [created, setCreated] = useState<CreatedCouponBatch | null>(null);

  const plan = planCouponBatch(draft, conflicts);
  const problem = plan.ok ? null : plan.problem;
  const previewCount =
    draft.quantity === "single" ? 1 : Math.min(COUPON_GENERATION.batchMax, Math.max(1, plan.count ?? 1));
  const request = previewRequestFromTerms(draft.terms, previewUses(previewCount, draft.terms.maxUses));
  const countInvalid = problem?.field === "count" && draft.count.trim() !== "";

  const update = (patch: Partial<CouponCreateDraft>) => setDraft((current) => ({ ...current, ...patch }));
  const updateTerms = (patch: Partial<CouponTermsDraft>) =>
    setDraft((current) => ({ ...current, terms: { ...current.terms, ...patch } }));

  const finish = () => {
    onClose();
    router.refresh();
  };

  const submit = () => {
    if (pending || !plan.ok) return;
    const { request: batch, count } = plan;
    start(async () => {
      try {
        const result = await generateCouponBatch(batch);
        if (result.ok) {
          const codes = result.coupons.map((coupon) => coupon.code);
          setCreated({ codes, template: batch.template, batchName: batch.batchName });
          toast.success(codes.length === 1 ? "Coupon created" : `${codes.length.toLocaleString("en-AE")} coupons created`);
          return;
        }
        if (result.conflicts.length > 0) {
          setConflicts((current) => [...new Set([...current, ...result.conflicts])]);
        }
        toast.error(count === 1 ? "The coupon was not created" : "The coupons were not created", {
          description: result.message,
        });
      } catch (cause) {
        console.error("[coupons] create did not respond", cause);
        toast.error("Check whether the coupons were created", {
          description: "The connection was interrupted. Reload the coupon list before creating them again.",
        });
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next || pending) return;
        if (created === null) onClose();
        else finish();
      }}
    >
      <DialogContent
        onPointerDownOutside={(event) => {
          if (created === null) event.preventDefault();
        }}
        className="flex max-h-dialog-max-h min-h-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-4xl"
      >
        {created !== null ? (
          <CreatedCouponsView batch={created} addons={addons} onDone={finish} />
        ) : (
          <>
            <DialogHeader className="shrink-0 border-b border-border p-5 pr-12 text-left">
              <DialogTitle>Create coupons</DialogTitle>
              <DialogDescription className="sr-only">
                Choose how many coupons to create, how their codes are named and the discount they give.
              </DialogDescription>
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
                <div className="grid min-w-0 gap-6 lg:grid-cols-5 lg:gap-8">
                  <fieldset disabled={pending} className="flex min-w-0 flex-col gap-6 lg:col-span-3">
                    <section className="flex min-w-0 flex-col gap-4">
                      <CouponChoiceGroup
                        legend="How many"
                        value={draft.quantity}
                        options={QUANTITY_OPTIONS}
                        disabled={pending}
                        onValueChange={(quantity) => update({ quantity })}
                      />
                      {draft.quantity === "several" && (
                        <div className="grid gap-4 sm:grid-cols-2">
                          {draft.naming === "random" && (
                            <Field data-invalid={countInvalid || undefined}>
                              <FieldLabel htmlFor={`${formId}-count`}>Number of coupons</FieldLabel>
                              <Input
                                id={`${formId}-count`}
                                type="number"
                                min={1}
                                max={COUPON_GENERATION.batchMax}
                                step={1}
                                value={draft.count}
                                disabled={pending}
                                aria-invalid={countInvalid || undefined}
                                aria-describedby={`${formId}-count-hint`}
                                onChange={(event) => update({ count: event.target.value })}
                              />
                              <p id={`${formId}-count-hint`} className="text-micro text-text-secondary">
                                {countInvalid ? COUPON_COUNT_MESSAGE : `From 1 to ${COUPON_GENERATION.batchMax.toLocaleString("en-AE")}.`}
                              </p>
                            </Field>
                          )}
                          <Field>
                            <FieldLabel htmlFor={`${formId}-batch`}>
                              Batch name <span className="font-normal text-text-muted">(optional)</span>
                            </FieldLabel>
                            <Input
                              id={`${formId}-batch`}
                              value={draft.batchName}
                              maxLength={COUPON_GENERATION.batchNameMax}
                              autoComplete="off"
                              disabled={pending}
                              onChange={(event) => update({ batchName: event.target.value })}
                            />
                          </Field>
                        </div>
                      )}
                    </section>

                    <Separator />

                    <section className="flex min-w-0 flex-col gap-4">
                      <CouponChoiceGroup
                        legend="Codes"
                        value={draft.naming}
                        options={NAMING_OPTIONS}
                        disabled={pending}
                        onValueChange={(naming) => update({ naming })}
                      />
                      {draft.naming === "random" ? (
                        <CouponRandomCodeFields draft={draft} onChange={update} disabled={pending} />
                      ) : (
                        <CouponOwnCodeFields draft={draft} onChange={update} conflicts={conflicts} disabled={pending} />
                      )}
                    </section>

                    <Separator />

                    <section className="flex min-w-0 flex-col gap-4" aria-labelledby={`${formId}-terms`}>
                      <h3 id={`${formId}-terms`} className={SECTION_HEADING_CLASS}>
                        Discount and rules
                      </h3>
                      <CouponTermsFields
                        terms={draft.terms}
                        onChange={updateTerms}
                        addons={addons}
                        disabled={pending}
                        invalid={highlightedTerm(problem?.field ?? null, draft.terms)}
                      />
                    </section>
                  </fieldset>

                  <div className="min-w-0 lg:col-span-2">
                    <ExpectedIncomePanel request={request} className="lg:sticky lg:top-0" />
                  </div>
                </div>
              </div>

              <DialogFooter className="mx-0 mb-0 shrink-0 border-t border-border bg-surface-raised p-4">
                <Button type="button" variant="ghost" hoverEffect="sweep" disabled={pending} onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={pending || !plan.ok}
                  aria-describedby={problem !== null && !pending ? `${formId}-problem` : undefined}
                >
                  {pending ? "Creating…" : createLabel(plan.count)}
                </Button>
                {problem !== null && !pending && (
                  <p
                    id={`${formId}-problem`}
                    className="text-micro text-pretty text-text-secondary sm:order-first sm:mr-auto sm:self-center"
                  >
                    {problem.message}
                  </p>
                )}
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
