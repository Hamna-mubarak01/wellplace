"use client";

import { ArrowLeftIcon, CheckIcon } from "lucide-react";

import {
  BOOKING_STEPS,
  stepIndex,
  type BookingStepId,
} from "@/components/booking/booking-steps";
import { Button } from "@/components/shared/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";


export interface BookingStepperProps {
  current: BookingStepId;
  completed: readonly BookingStepId[];
  onNavigate: (id: BookingStepId) => void;
  navigationLocked?: boolean;
  className?: string;
}

export function BookingStepper({
  current,
  completed,
  onNavigate,
  className,
  navigationLocked = false,
}: BookingStepperProps) {
  const currentIndex = stepIndex(current);
  const currentStep = BOOKING_STEPS[currentIndex];
  const previous = currentIndex > 0 ? BOOKING_STEPS[currentIndex - 1] : null;
  const canGoBack = previous !== null && completed.includes(previous.id);

  return (
    <nav aria-label="Booking steps" className={className}>
      <div className="md:hidden">
        <div className="flex min-h-tap items-center gap-2">
          {canGoBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={navigationLocked}
              tone="plain"
              onClick={() => onNavigate(previous.id)}
              aria-label={`Back to ${previous.label}`}
              className="size-tap shrink-0 rounded-(--radius-control) text-text-secondary hover:text-text-primary"
            >
              <ArrowLeftIcon aria-hidden />
            </Button>
          ) : null}

          <p className="min-w-0 text-small text-text-secondary">
            <span className="font-data tabular-nums">
              Step {currentIndex + 1} of {BOOKING_STEPS.length}
            </span>
            <span aria-hidden> · </span>
            <span className="font-medium text-text-primary">{currentStep?.label}</span>
          </p>
        </div>

        <Progress
          value={((currentIndex + 1) / BOOKING_STEPS.length) * 100}
          aria-label={`Step ${currentIndex + 1} of ${BOOKING_STEPS.length}`}
          className="mt-2 h-0.5 bg-border"
        />
      </div>

      <ol className="hidden md:flex md:items-start">
        {BOOKING_STEPS.map((step, index) => {
          const isCurrent = step.id === current;
          const isDone = index < currentIndex;
          const isFirst = index === 0;
          const isLast = index === BOOKING_STEPS.length - 1;

          const leftDone = index <= currentIndex && !isFirst;
          const rightDone = index < currentIndex;

          const marker = (
            <span
              aria-hidden
              className={cn(
                "relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
                isDone
                  ? "border-brand bg-brand text-on-brand"
                  : isCurrent
                    ? 'border-brand bg-surface-base step-pulse'
                    : "border-border bg-surface-base",
              )}
            >
              {isDone ? (
                <CheckIcon aria-hidden className="size-3" />
              ) : isCurrent ? (
                <span className="size-2 rounded-full bg-brand" />
              ) : null}
            </span>
          );

          const label = (
            <span
              className={cn(
                "mt-2 block text-center text-small transition-colors duration-150",
                isCurrent
                  ? "font-semibold text-brand"
                  : isDone
                    ? "font-medium text-text-primary"
                    : "font-regular text-text-muted",
              )}
            >
              {step.label}
              {!step.reachable ? <span className="sr-only"> — not open yet</span> : null}
            </span>
          );

          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className="flex min-w-0 flex-1 flex-col items-center"
            >
              <span className="flex w-full items-center">
                <span
                  aria-hidden
                  className={cn(
                    "h-0.5 flex-1",
                    isFirst ? "bg-transparent" : leftDone ? "bg-brand" : "bg-border",
                  )}
                />
                {marker}
                <span
                  aria-hidden
                  className={cn(
                    "h-0.5 flex-1",
                    isLast ? "bg-transparent" : rightDone ? "bg-brand" : "bg-border",
                  )}
                />
              </span>

              {isDone ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={navigationLocked}
                  onClick={() => onNavigate(step.id)}
                  tone="plain"
                  className="h-auto w-full rounded-(--radius-control) px-0 py-0"
                >
                  {label}
                </Button>
              ) : (
                label
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
