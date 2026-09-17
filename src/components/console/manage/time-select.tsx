"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";

const HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);

const MINUTE_STEP = 1;

const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, index) =>
  String(index * MINUTE_STEP).padStart(2, "0"),
);

function split(value: string): { hour: string; minute: string } {
  const [hour = "", minute = ""] = value.split(":");
  return {
    hour: HOURS.includes(hour) ? hour : "",
    minute: MINUTES.includes(minute) ? minute : "",
  };
}

export interface TimeSelectProps {
  value: string;
  label: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function TimeSelect({
  value,
  label,
  disabled = false,
  onChange,
}: TimeSelectProps) {
  const { hour, minute } = split(value);

  return (
    <span className="flex min-w-0 items-center gap-1">
      <Select
        value={hour}
        disabled={disabled}
        onValueChange={(next) => onChange(`${next}:${minute || "00"}`)}
      >
        <SelectTrigger
          aria-label={`${label}, hour`}
          className="min-h-tap w-20 font-data text-console-body tabular-nums"
        >
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {HOURS.map((option) => (
            <SelectItem
              key={option}
              value={option}
              className="min-h-tap font-data tabular-nums"
            >
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span aria-hidden="true" className="font-data text-text-muted">
        :
      </span>

      <Select
        value={minute}
        disabled={disabled}
        onValueChange={(next) => onChange(`${hour || "00"}:${next}`)}
      >
        <SelectTrigger
          aria-label={`${label}, minute`}
          className="min-h-tap w-20 font-data text-console-body tabular-nums"
        >
          <SelectValue placeholder="--" />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {MINUTES.map((option) => (
            <SelectItem
              key={option}
              value={option}
              className="min-h-tap font-data tabular-nums"
            >
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </span>
  );
}
