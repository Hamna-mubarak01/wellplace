"use client";

import { ImageIcon, MinusIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import { formatAed } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import { addonKindLabel } from "@/lib/config/addons";
import { savingPercentOf } from "@/lib/domain/pricing";
import { clampQuantity, type CartLine } from "@/lib/domain/vouchers";
import { cn } from "@/lib/utils";
import type { ReceptionAddonOption } from "@/components/console/reception/walk-in-form";

export interface AddonRowProps {
  addon: ReceptionAddonOption;
  line: CartLine | null;
  onQuantityChange: (id: string, quantity: number) => void;
  disabled: boolean;
}

const THUMB_SIZES = "6rem";

const BADGE_CLASS = "text-micro font-medium";

export function AddonRow({ addon, line, onQuantityChange, disabled }: AddonRowProps) {
  const quantity = line?.quantity ?? 0;
  const inCart = quantity > 0;
  const included = line?.isIncluded ?? addon.offerUnitPriceFils === 0;
  const locked = addon.isLocked && included;
  const soldOut = addon.isSoldOut;
  const unavailable = soldOut && !inCart;

  const unitPriceFils = line?.unitPriceFils ?? addon.offerUnitPriceFils;
  const discounted = unitPriceFils < addon.regularUnitPriceFils;
  const percent = savingPercentOf(addon.regularUnitPriceFils, unitPriceFils);
  const saving =
    addon.savingLabel !== null && addon.savingLabel.trim() !== ""
      ? addon.savingLabel
      : `Save ${percent}%`;

  const kindLabel = addonKindLabel(addon.kind);
  const description = addon.description?.trim() ?? "";
  const headingId = `walk-in-addon-${addon.id}`;

  const step = (next: number) =>
    onQuantityChange(addon.id, next <= 0 ? 0 : clampQuantity(addon, next));

  return (
    <li
      aria-labelledby={headingId}
      className={cn(
        "flex min-w-0 gap-3 rounded-(--radius-card) border border-border bg-surface-raised p-3",
        inCart && "border-border-strong",
        unavailable && "opacity-70",
      )}
    >
      {addon.imagePath === null || addon.imagePath.trim() === "" ? (
        <span
          aria-hidden="true"
          className="flex aspect-4/3 w-addon-thumb shrink-0 items-center justify-center rounded-(--radius-control) bg-surface-sunken text-text-muted"
        >
          <ImageIcon className="size-5" />
        </span>
      ) : (
        <MediaFrame
          src={addon.imagePath}
          alt={addon.imageAlt}
          sizes={THUMB_SIZES}
          frameClassName="aspect-4/3 w-addon-thumb shrink-0 rounded-(--radius-control)"
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
            <h3
              id={headingId}
              className="min-w-0 text-console-body font-medium text-pretty text-text-primary"
            >
              {addon.name}
            </h3>
            {kindLabel !== null ? (
              <span className="shrink-0 text-console-label font-medium tracking-label text-text-muted uppercase">
                {kindLabel}
              </span>
            ) : null}
          </div>

          {description !== "" ? (
            <p className="mt-1 text-micro text-pretty text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>

        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          {discounted ? (
            <span className="font-data text-micro tabular-nums text-text-muted line-through">
              {formatAed(addon.regularUnitPriceFils)}
            </span>
          ) : null}

          {included ? (
            <Badge
              variant="outline"
              className={cn(
                BADGE_CLASS,
                "border-success-border bg-success-wash text-success-ink",
              )}
            >
              {line?.voucherCode
                ? `Free with ${line.voucherCode}`
                : "Free special offer"}
            </Badge>
          ) : (
            <>
              <span className="font-data text-console-body font-medium tabular-nums text-text-primary">
                {formatAed(unitPriceFils)}
              </span>
              {discounted ? (
                <span className="text-micro font-medium text-brand">{saving}</span>
              ) : null}
            </>
          )}

          {soldOut ? (
            <Badge
              variant="outline"
              className={cn(
                BADGE_CLASS,
                "border-warning-border bg-warning-wash text-warning-ink",
              )}
            >
              Sold out
            </Badge>
          ) : null}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {inCart ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Fewer ${addon.name}`}
                disabled={disabled || quantity <= addon.minQuantity}
                onClick={() => step(quantity - 1)}
              >
                <MinusIcon aria-hidden="true" className="size-4" />
              </Button>

              <output
                aria-label={`${addon.name} quantity`}
                className="min-w-6 text-center font-data text-console-body tabular-nums text-text-primary"
              >
                {quantity}
              </output>

              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`More ${addon.name}`}
                disabled={
                  disabled || soldOut || quantity >= addon.maxQuantity
                }
                onClick={() => step(quantity + 1)}
              >
                <PlusIcon aria-hidden="true" className="size-4" />
              </Button>

              {locked ? (
                <span className="text-micro text-text-secondary">
                  Always prepared
                </span>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${addon.name}`}
                  disabled={disabled}
                  onClick={() => step(0)}
                >
                  Remove
                </Button>
              )}

              {unitPriceFils > 0 && quantity > 1 ? (
                <span className="ml-auto font-data text-console-body tabular-nums text-text-primary">
                  {formatAed(unitPriceFils * quantity)}
                </span>
              ) : null}
            </>
          ) : soldOut ? (
            <p className="text-micro text-text-secondary">
              Not available today. Management can restock it in the add-on
              catalogue.
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Add ${addon.name}`}
              disabled={disabled}
              onClick={() => step(addon.defaultQuantity)}
            >
              Add
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
