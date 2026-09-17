"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shared/select";
import { cn } from "@/lib/utils";


export interface ChildAgeSelectProps {
  id: string;
  label: string;
  minAge: number;
  maxAge: number;
  value: number | null;
  onValueChange: (age: number) => void;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
}

export function ChildAgeSelect({
  id,
  label,
  minAge,
  maxAge,
  value,
  onValueChange,
  invalid = false,
  describedBy,
  className,
}: ChildAgeSelectProps) {
  const ages = Array.from({ length: maxAge - minAge + 1 }, (_, index) => minAge + index);
  const labelId = `${id}-label`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span id={labelId} className="text-field-label font-medium text-text-secondary">
        {label}
        <span aria-hidden className="ml-1 text-brand">
          *
        </span>
        <span className="sr-only"> (required)</span>
      </span>
      <Select
        value={value === null ? undefined : String(value)}
        onValueChange={(next) => onValueChange(Number(next))}
      >
        <SelectTrigger
          id={id}
          aria-labelledby={`${labelId} ${id}`}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="h-control w-full rounded-(--radius-card) bg-surface-raised px-4 text-control"
        >
          <SelectValue placeholder="Age" />
        </SelectTrigger>
        <SelectContent>
          {ages.map((age) => (
            <SelectItem key={age} value={String(age)}>
              {age}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
