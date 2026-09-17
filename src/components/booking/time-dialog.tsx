"use client";

import { useMemo, useState } from "react";

import type { AlternativeDate, DayStatus } from "@/components/booking/booking-types";
import { NoTimes } from "@/components/booking/no-times";
import {
  groupSlotsByPeriod,
  type SlotPeriod,
} from "@/components/booking/time-periods";
import { TimeTileList } from "@/components/shared/time-tile-list";
import { TimeTileSkeleton } from "@/components/shared/time-tile-skeleton";
import type { TimeSlot } from "@/components/shared/time-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/shared/button";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";


export interface TimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  dayLabel: string;
  dateKey: string;
  dayStatus: DayStatus;
  durationHours: number;

  slots: readonly TimeSlot[];
  value: string | null;
  onValueChange: (startsAt: string | null) => void;
  onHoldExpire?: (startsAt: string) => void;

  alternativeDurations: readonly number[];
  onDurationChange: (durationHours: number) => void;
  alternativeDates: readonly AlternativeDate[];
  onDateChange: (dateKey: string) => void;

  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function TimeDialogBody({
  dateKey,
  dayStatus,
  durationHours,
  slots,
  value,
  onValueChange,
  onHoldExpire,
  alternativeDurations,
  onDurationChange,
  alternativeDates,
  onDateChange,
  loading,
  error,
  onRetry,
  onChoose,
}: Omit<TimeDialogProps, "open" | "onOpenChange" | "dayLabel"> & {
  onChoose: () => void;
}) {
  const periods = useMemo(() => groupSlotsByPeriod(slots, dateKey), [slots, dateKey]);

  const [pressedPeriod, setPressedPeriod] = useState<string | null>(null);

  const activePeriod =
    periods.find((period) => period.id === pressedPeriod)?.id ??
    periods.find((period) =>
      period.slots.some((slot) => slot.startsAt === value),
    )?.id ??
    periods[0]?.id;

  const grid = (period: SlotPeriod) => (
    <TimeTileList
      layout="grid"
      label={`${period.label} start times`}
      slots={period.slots}
      value={value}
      onValueChange={(next) => {
        onValueChange(next);
        if (next !== null) onChoose();
      }}
      onHoldExpire={onHoldExpire}
      showAvailability={false}
    />
  );

  if (loading) {
    return (
      <>
        <p className="sr-only" role="status">
          Loading start times
        </p>
        <TimeTileSkeleton count={5} />
      </>
    );
  }

  if (error) {
    return (
      <Alert className="rounded-none border-0 border-l-2 border-l-danger bg-transparent px-4 py-0">
        <AlertTitle className="text-body font-medium text-text-primary">
          Start times could not be loaded
        </AlertTitle>
        <AlertDescription className="text-small text-text-secondary">
          <p className="text-pretty">{error}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              onClick={onRetry}
              className="mt-3 h-control rounded-(--radius-card) border-border bg-surface-raised px-4 text-control text-text-primary hover:border-brand hover:bg-surface-hover"
            >
              Try again
            </Button>
          ) : null}
        </AlertDescription>
      </Alert>
    );
  }

  if (periods.length === 0) {
    return (
      <NoTimes
        dayStatus={dayStatus}
        durationHours={durationHours}
        alternativeDurations={alternativeDurations}
        onDurationChange={onDurationChange}
        alternativeDates={alternativeDates}
        onDateChange={onDateChange}
      />
    );
  }

  if (periods.length === 1) return grid(periods[0]);

  return (
    <Tabs value={activePeriod} onValueChange={setPressedPeriod}>
      <TabsList
        aria-label="Time of day"
        className="w-full gap-1 rounded-(--radius-card) border border-border bg-surface-sunken p-1 group-data-horizontal/tabs:h-auto"
      >
        {periods.map((period) => (
          <TabsTrigger
            key={period.id}
            value={period.id}
            className={cn(
              "h-auto min-h-tap flex-1 flex-col gap-0.5 rounded-(--radius-control) px-2 py-2 text-control font-medium whitespace-nowrap text-text-secondary transition-colors duration-150 sm:px-3",
              "hover:text-text-primary",
              "data-active:border-brand data-active:bg-brand-wash data-active:font-bold data-active:text-brand",
              "dark:data-active:border-brand dark:data-active:bg-brand-wash dark:data-active:text-brand",
            )}
          >
            {period.label}
            <span className="font-data text-micro font-normal tabular-nums text-text-muted">{period.range}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {periods.map((period) => (
        <TabsContent key={period.id} value={period.id} className="mt-1">
          {grid(period)}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function TimeDialog({ open, onOpenChange, dayLabel, ...body }: TimeDialogProps) {
  const isMobile = useIsMobile();

  const { durationHours } = body;
  const description = `Start times for a ${durationHours}-hour session. Your suite is held for you once you continue to payment.`;

  const content = (
    <TimeDialogBody {...body} onChoose={() => onOpenChange(false)} />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="border-border bg-surface-raised">
          <DrawerHeader className="px-5 text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left">
            <DrawerTitle className="font-body text-subhead font-medium text-text-primary">
              {dayLabel}
            </DrawerTitle>
            <DrawerDescription className="text-fine text-pretty text-text-secondary">
              {description}
            </DrawerDescription>
          </DrawerHeader>

          <div className="max-h-times-scroll overflow-y-auto px-5 pt-1 pb-safe">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-times-dialog gap-0 border border-border bg-surface-raised p-0 sm:max-w-times-dialog">
        <DialogHeader className="border-b border-border px-6 pt-6 pr-12 pb-4 text-left">
          <DialogTitle className="font-body text-subhead font-medium text-text-primary">
            {dayLabel}
          </DialogTitle>
          <DialogDescription className="text-fine text-pretty text-text-secondary">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-times-scroll overflow-y-auto px-6 py-5">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
