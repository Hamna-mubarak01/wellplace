"use client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { HoldCountdown } from "@/components/shared/hold-countdown";
import { formatAed } from "@/components/shared/money";
import type {
  PreparedPayment,
  SimulationOutcome,
} from "@/lib/config/checkout-flow";

const OUTCOMES = [
  ["success", "Successful payment"],
  ["failed", "Declined payment"],
  ["cancelled", "Cancelled payment"],
] as const;

export function SimulatedPayment({
  payment,
  outcome,
  onChange,
  onHoldExpire,
  disabled = false,
}: {
  payment: PreparedPayment;
  outcome: SimulationOutcome["outcome"];
  onChange: (outcome: SimulationOutcome["outcome"]) => void;
  onHoldExpire?: () => void;
  disabled?: boolean;
}) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader className="gap-2">
        <Badge variant="outline" className="w-fit">Test mode</Badge>
        <CardTitle>
          <h2 className="font-display text-h3 font-medium text-text-primary">Payment</h2>
        </CardTitle>
        <p className="text-small text-text-secondary">
          Online payment is not connected yet, so this step simulates it. No money is charged and no card details are needed.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-small text-text-secondary">Total to pay</span>
          <span className="font-data text-h2 whitespace-nowrap tabular-nums text-text-primary">
            {formatAed(payment.amountFils)}
          </span>
        </div>
        <p className="text-small text-text-secondary" role="status">
          Your time is held for{" "}
          <HoldCountdown
            expiresAt={new Date(payment.expiresAt)}
            onExpire={onHoldExpire}
            className="font-data font-medium tabular-nums text-text-primary"
          />
          . Complete the payment before then to keep it.
        </p>
        <fieldset disabled={disabled} className="space-y-2">
          <legend className="text-small font-medium text-text-primary">Choose the result to simulate</legend>
          <RadioGroup
            value={outcome}
            onValueChange={(value) => onChange(value as SimulationOutcome["outcome"])}
          >
            {OUTCOMES.map(([value, label]) => (
              <div key={value} className="flex min-h-tap items-center gap-3">
                <RadioGroupItem value={value} id={`payment-${value}`} />
                <Label htmlFor={`payment-${value}`}>{label}</Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>
      </CardContent>
    </Card>
  );
}
