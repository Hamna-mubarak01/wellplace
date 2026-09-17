import { z } from "zod";
import { CHECKOUT_FLOW } from "@/lib/config/checkout-flow";
import type { CouponPatternProblem } from "@/lib/domain/vouchers/coupon-codes";

export const COUPON_LIMITS = {
  maxUses: 1_000_000,
  perCustomerDefault: 1,
  codeMin: 3,
  codeMax: 40,
  percentMax: 100,
} as const;
export const COUPON_GENERATION = {
  alphabet: "ACDEFGHJKLMNPQRTUVWXY34679",
  randomLengthMin: 4,
  randomLengthMax: 12,
  randomLengthDefault: 6,
  batchMax: 500,
  combinationsPerCode: 20,
  conflictRetries: 3,
  segmentMaxLength: 16,
  batchNameMax: 80,
} as const;

export const COUPON_PREVIEW = {
  startTime: "12:00",
  dubaiOffset: "+04:00",
} as const;

export const COUPON_OVERVIEW = {
  expiringSoonDays: 7,
} as const;

export const COUPON_CODE_RULES = {
  alphabet: COUPON_GENERATION.alphabet,
  minLength: COUPON_LIMITS.codeMin,
  maxLength: COUPON_LIMITS.codeMax,
  randomLengthMin: COUPON_GENERATION.randomLengthMin,
  randomLengthMax: COUPON_GENERATION.randomLengthMax,
  combinationsPerCode: COUPON_GENERATION.combinationsPerCode,
} as const;

export const COUPON_PATTERN_MESSAGE: Readonly<Record<CouponPatternProblem, string>> = {
  random_part_too_short: `Use at least ${COUPON_GENERATION.randomLengthMin} random characters.`,
  random_part_too_long: `Use no more than ${COUPON_GENERATION.randomLengthMax} random characters.`,
  code_too_long: `Each code must stay within ${COUPON_LIMITS.codeMax} characters. Shorten the prefix, brand name or brand number.`,
  code_too_short: `Each code needs at least ${COUPON_LIMITS.codeMin} characters.`,
  too_few_combinations: "There are not enough unused codes for this many coupons. Add more random characters or generate fewer coupons.",
};

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(
    COUPON_LIMITS.codeMin,
    `Enter a code with at least ${COUPON_LIMITS.codeMin} characters.`,
  )
  .max(
    COUPON_LIMITS.codeMax,
    `Keep the code within ${COUPON_LIMITS.codeMax} characters.`,
  )
  .regex(
    /^[A-Z0-9]+(-[A-Z0-9]+)*$/,
    "Use letters, numbers and single hyphens in the code.",
  );

const couponKindSchema = z.enum(["fixed", "percent", "addon_free"]);

const couponAmountSchema = z
  .number()
  .int()
  .positive("Enter a discount amount greater than zero.")
  .max(
    CHECKOUT_FLOW.maxAmountFils,
    `The discount cannot exceed AED ${(CHECKOUT_FLOW.maxAmountFils / 100).toLocaleString("en-AE")}.`,
  )
  .nullable();

const couponPercentSchema = z
  .number()
  .positive("Enter a percentage greater than zero.")
  .max(COUPON_LIMITS.percentMax, "The discount cannot exceed 100%.")
  .multipleOf(0.01, "Use no more than two decimal places.")
  .nullable();

const couponAddonIdsSchema = z.array(z.uuid()).max(CHECKOUT_FLOW.maxQuantity);

const couponTermFields = {
  kind: couponKindSchema,
  amountFils: couponAmountSchema,
  percent: couponPercentSchema,
  addonIds: couponAddonIdsSchema,
  validFrom: z.iso.date().nullable(),
  validTo: z.iso.date().nullable(),
  maxUses: z
    .number()
    .int("Enter a whole number of uses.")
    .positive(
      "Enter at least one use, or leave this empty for unlimited uses.",
    )
    .max(
      COUPON_LIMITS.maxUses,
      `Total uses cannot exceed ${COUPON_LIMITS.maxUses.toLocaleString("en-AE")}.`,
    )
    .nullable(),
  perCustomerLimit: z
    .number()
    .int("Enter a whole number of uses per customer.")
    .positive(
      "Enter at least one use per customer, or leave this empty for unlimited uses.",
    )
    .max(
      COUPON_LIMITS.maxUses,
      `Uses per customer cannot exceed ${COUPON_LIMITS.maxUses.toLocaleString("en-AE")}.`,
    )
    .nullable(),
  isCombinable: z.boolean(),
  isActive: z.boolean(),
};

interface CouponDiscountShape {
  readonly kind: z.infer<typeof couponKindSchema>;
  readonly amountFils: number | null;
  readonly percent: number | null;
  readonly addonIds: readonly string[];
}

interface CouponTermsShape extends CouponDiscountShape {
  readonly validFrom: string | null;
  readonly validTo: string | null;
}

function refineCouponDiscount(value: CouponDiscountShape, context: z.RefinementCtx) {
  if (value.kind === "fixed" && !value.amountFils)
    context.addIssue({
      code: "custom",
      path: ["amountFils"],
      message: "Enter a discount amount greater than zero.",
    });
  if (value.kind === "percent" && !value.percent)
    context.addIssue({
      code: "custom",
      path: ["percent"],
      message: "Enter a percentage above zero and no more than 100.",
    });
  if (value.kind === "addon_free" && !value.addonIds.length)
    context.addIssue({
      code: "custom",
      path: ["addonIds"],
      message: "Select at least one add-on.",
    });
}

function refineCouponTerms(value: CouponTermsShape, context: z.RefinementCtx) {
  refineCouponDiscount(value, context);
  if (value.validFrom && value.validTo && value.validTo < value.validFrom)
    context.addIssue({
      code: "custom",
      path: ["validTo"],
      message: "The expiry date must be on or after the start date.",
    });
}

export const couponSchema = z
  .object({
    id: z.uuid().nullable(),
    updatedAt: z.string().nullable(),
    code: couponCodeSchema,
    ...couponTermFields,
  })
  .strict()
  .superRefine(refineCouponTerms);
export type CouponInput = z.infer<typeof couponSchema>;

export const couponTemplateSchema = z
  .object(couponTermFields)
  .strict()
  .superRefine(refineCouponTerms);
export type CouponTemplate = z.infer<typeof couponTemplateSchema>;

const codeSegmentSchema = z
  .string()
  .trim()
  .max(
    COUPON_GENERATION.segmentMaxLength,
    `Keep each part of the code within ${COUPON_GENERATION.segmentMaxLength} characters.`,
  );

export const couponCodeSourceSchema = z.discriminatedUnion("mode", [
  z
    .object({
      mode: z.literal("random"),
      count: z
        .number()
        .int("Enter a whole number of coupons.")
        .min(1, "Generate at least one coupon.")
        .max(
          COUPON_GENERATION.batchMax,
          `Generate no more than ${COUPON_GENERATION.batchMax} coupons at a time.`,
        ),
      prefix: codeSegmentSchema,
      brandName: codeSegmentSchema,
      brandNumber: codeSegmentSchema,
      randomLength: z
        .number()
        .int()
        .min(
          COUPON_GENERATION.randomLengthMin,
          `Use at least ${COUPON_GENERATION.randomLengthMin} random characters.`,
        )
        .max(
          COUPON_GENERATION.randomLengthMax,
          `Use no more than ${COUPON_GENERATION.randomLengthMax} random characters.`,
        ),
    })
    .strict(),
  z
    .object({
      mode: z.literal("list"),
      codes: z
        .array(couponCodeSchema)
        .min(1, "Enter at least one coupon code.")
        .max(
          COUPON_GENERATION.batchMax,
          `Enter no more than ${COUPON_GENERATION.batchMax} codes at a time.`,
        ),
    })
    .strict(),
]);
export type CouponCodeSource = z.infer<typeof couponCodeSourceSchema>;

export const couponBatchSchema = z
  .object({
    template: couponTemplateSchema,
    source: couponCodeSourceSchema,
    batchName: z
      .string()
      .trim()
      .max(
        COUPON_GENERATION.batchNameMax,
        `Keep the batch name within ${COUPON_GENERATION.batchNameMax} characters.`,
      )
      .nullable(),
  })
  .strict();
export type CouponBatchRequest = z.infer<typeof couponBatchSchema>;

export const couponPreviewSchema = z
  .object({
    kind: couponKindSchema,
    amountFils: couponAmountSchema,
    percent: couponPercentSchema,
    addonIds: couponAddonIdsSchema,
    uses: z
      .number()
      .int()
      .min(1)
      .max(COUPON_GENERATION.batchMax * COUPON_LIMITS.maxUses),
  })
  .strict()
  .superRefine(refineCouponDiscount);
export type CouponPreviewRequest = z.infer<typeof couponPreviewSchema>;

export interface CouponRow extends CouponInput {
  usedCount: number;
  batchId: string | null;
  batchName: string | null;
}
