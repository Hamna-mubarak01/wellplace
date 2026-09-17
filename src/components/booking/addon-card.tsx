"use client";

import { useState, type ReactNode } from "react";
import { ChevronRightIcon, GiftIcon, ImageIcon, MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  addonKindLabel,
  type BookingAddonCard as BookingAddonCardData,
} from "@/components/booking/booking-types";
import { Button } from "@/components/shared/button";
import { MediaFrame } from "@/components/shared/media-frame";
import { formatAed } from "@/components/shared/money";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { savingPercentOf } from "@/lib/domain/pricing";
import { clampQuantity, type CartLine } from "@/lib/domain/vouchers";
import { cn } from "@/lib/utils";

export interface AddonCardProps {
  addon: BookingAddonCardData;
  line: CartLine | null;
  onQuantityChange: (id: string, quantity: number) => void;
  disabled?: boolean;
  className?: string;
}

const THUMB_SIZES = "6rem";
const DETAIL_SIZES = "(min-width: 640px) 32rem, 100vw";

interface AddonView {
  quantity: number;
  inCart: boolean;
  complimentary: boolean;
  includedWithCode: boolean;
  locked: boolean;
  soldOut: boolean;
  unavailable: boolean;
  unitPriceFils: number;
  discounted: boolean;
  percent: number;
  kindLabel: string | null;
}

function viewOf(addon: BookingAddonCardData, line: CartLine | null): AddonView {
  const quantity = line?.quantity ?? 0;
  const included = line?.isIncluded ?? addon.offerUnitPriceFils === 0;
  const includedWithCode = included && line?.voucherCode !== null && line?.voucherCode !== undefined;
  const unitPriceFils = line?.unitPriceFils ?? addon.offerUnitPriceFils;
  return {
    quantity,
    inCart: quantity > 0,
    complimentary: included && !includedWithCode,
    includedWithCode,
    locked: addon.isLocked && included,
    soldOut: addon.isSoldOut,
    unavailable: addon.isSoldOut || Boolean(addon.availabilityMessage),
    unitPriceFils,
    discounted: unitPriceFils < addon.regularUnitPriceFils,
    percent: savingPercentOf(addon.regularUnitPriceFils, unitPriceFils),
    kindLabel: addonKindLabel(addon.kind),
  };
}

function Price({ addon, view }: { addon: BookingAddonCardData; view: AddonView }) {
  if (view.complimentary) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-success-border bg-success-wash text-pill font-semibold text-success-ink"
      >
        <GiftIcon aria-hidden="true" className="size-3" />
        Complimentary
      </Badge>
    );
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="font-data text-small font-semibold tabular-nums text-text-primary">
        {formatAed(view.unitPriceFils)}
      </span>
      {view.discounted ? (
        <span className="font-data text-fine tabular-nums text-text-muted line-through">
          {formatAed(addon.regularUnitPriceFils)}
        </span>
      ) : null}
      {view.includedWithCode ? (
        <span className="text-fine font-medium text-success-ink">Included with code</span>
      ) : view.discounted ? (
        <span className="text-fine font-medium text-brand">
          {addon.savingLabel !== null && addon.savingLabel.trim() !== "" ? addon.savingLabel : `Save ${view.percent}%`}
        </span>
      ) : null}
    </span>
  );
}

function QuantityControl({
  addon,
  view,
  disabled,
  onQuantityChange,
  wide = false,
}: {
  addon: BookingAddonCardData;
  view: AddonView;
  disabled: boolean;
  onQuantityChange: (id: string, quantity: number) => void;
  wide?: boolean;
}) {
  if (view.complimentary) return null;

  if (view.unavailable) {
    return (
      <Badge
        variant="outline"
        className="shrink-0 border-border-strong bg-surface-base text-pill font-medium text-text-secondary"
      >
        {view.soldOut ? "Sold out" : "Unavailable"}
      </Badge>
    );
  }

  const step = (next: number) => onQuantityChange(addon.id, next <= 0 ? 0 : clampQuantity(addon, next));

  if (!view.inCart) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => step(addon.defaultQuantity)}
        aria-label={`Add ${addon.name}`}
        className={cn("shrink-0 gap-1.5", wide && "w-full")}
      >
        <PlusIcon aria-hidden="true" className="size-4" />
        Add
      </Button>
    );
  }

  const removesOnMinus = !view.locked && view.quantity <= addon.minQuantity;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-(--radius-card) border border-brand/40 bg-brand-wash p-0.5",
        wide && "w-full justify-between",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={removesOnMinus ? `Remove ${addon.name}` : `Fewer ${addon.name}`}
        disabled={disabled || (view.locked && view.quantity <= addon.minQuantity)}
        onClick={() => step(removesOnMinus ? 0 : view.quantity - 1)}
      >
        {removesOnMinus ? <Trash2Icon aria-hidden="true" className="size-4" /> : <MinusIcon aria-hidden="true" className="size-4" />}
      </Button>
      <output
        aria-label={`${addon.name} quantity`}
        className="min-w-6 text-center font-data text-small font-semibold tabular-nums text-text-primary"
      >
        {view.quantity}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`More ${addon.name}`}
        disabled={disabled || view.quantity >= addon.maxQuantity}
        onClick={() => step(view.quantity + 1)}
      >
        <PlusIcon aria-hidden="true" className="size-4" />
      </Button>
    </div>
  );
}

function Thumb({ addon, className }: { addon: BookingAddonCardData; className?: string }) {
  return addon.imagePath ? (
    <MediaFrame
      src={addon.imagePath}
      alt=""
      sizes={THUMB_SIZES}
      frameClassName={cn("shrink-0 rounded-(--radius-control)", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-(--radius-control) bg-surface-sunken", className)}
    >
      <ImageIcon className="size-6 text-text-muted" />
    </span>
  );
}

function AddonDetails({
  addon,
  view,
  disabled,
  onQuantityChange,
}: {
  addon: BookingAddonCardData;
  view: AddonView;
  disabled: boolean;
  onQuantityChange: (id: string, quantity: number) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {addon.imagePath ? (
        <MediaFrame
          src={addon.imagePath}
          alt={addon.name}
          sizes={DETAIL_SIZES}
          frameClassName="aspect-3/2 w-full rounded-(--radius-card)"
        />
      ) : (
        <div className="grid aspect-3/2 w-full place-items-center rounded-(--radius-card) bg-surface-sunken">
          <ImageIcon aria-hidden="true" className="size-10 text-text-muted" />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Price addon={addon} view={view} />
        <span className="text-micro text-text-muted">{addon.isTaxable === false ? "No VAT applies" : "VAT included"}</span>
      </div>
      {view.complimentary ? (
        <p className="text-fine text-pretty text-text-secondary">
          Complimentary with every booking and prepared before you arrive.
        </p>
      ) : null}
      {addon.availabilityMessage ? <p className="text-fine text-text-secondary">{addon.availabilityMessage}</p> : null}
      <QuantityControl addon={addon} view={view} disabled={disabled} onQuantityChange={onQuantityChange} wide />
    </div>
  );
}

function DetailsShell({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="border-border bg-surface-raised">
          <DrawerHeader className="px-5 text-left">
            <DrawerTitle className="font-display text-h3 font-medium text-text-primary">{title}</DrawerTitle>
            <DrawerDescription className="text-small text-pretty text-text-secondary">{description}</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-times-scroll overflow-y-auto px-5 pb-safe">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 border border-border bg-surface-raised p-0 sm:max-w-lg">
        <DialogHeader className="px-6 pt-6 pr-12 pb-4 text-left">
          <DialogTitle className="font-display text-h3 font-medium text-text-primary">{title}</DialogTitle>
          <DialogDescription className="text-small text-pretty text-text-secondary">{description}</DialogDescription>
        </DialogHeader>
        <div className="px-6 pb-6">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function AddonCard({ addon, line, onQuantityChange, disabled = false, className }: AddonCardProps) {
  const [open, setOpen] = useState(false);
  const view = viewOf(addon, line);
  const headingId = `book-addon-${addon.id}-name`;
  const description = addon.description?.trim() ?? "";

  return (
    <li aria-labelledby={headingId} className={cn("@container min-w-0 list-none", className)}>
      <div
        className={cn(
          "flex flex-col items-stretch gap-2 py-3 @sm:flex-row @sm:items-center @sm:gap-4",
          view.unavailable && "opacity-70",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={() => setOpen(true)}
          aria-label={`View details of ${addon.name}`}
          className="h-auto! min-h-tap min-w-0 flex-1 items-center justify-start gap-3 overflow-visible rounded-(--radius-card) px-1 py-1 text-left font-normal whitespace-normal @sm:gap-4"
        >
          <Thumb addon={addon} className="size-18 sm:size-20" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span id={headingId} className="font-display text-body font-medium text-pretty text-text-primary">
                {addon.name}
              </span>
              {view.kindLabel !== null ? (
                <span className="text-micro tracking-label text-text-muted uppercase">{view.kindLabel}</span>
              ) : null}
            </span>
            {description !== "" ? (
              <span className="line-clamp-2 text-fine text-pretty text-text-secondary">{description}</span>
            ) : null}
            <Price addon={addon} view={view} />
          </span>
          <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-text-muted" />
        </Button>

        <div className="flex justify-end">
          <QuantityControl addon={addon} view={view} disabled={disabled} onQuantityChange={onQuantityChange} />
        </div>
      </div>

      <DetailsShell
        open={open}
        onOpenChange={setOpen}
        title={addon.name}
        description={description !== "" ? description : (view.kindLabel ?? "Add-on")}
      >
        <AddonDetails addon={addon} view={view} disabled={disabled} onQuantityChange={onQuantityChange} />
      </DetailsShell>
    </li>
  );
}
