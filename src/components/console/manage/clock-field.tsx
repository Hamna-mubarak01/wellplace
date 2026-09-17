import { OpeningTime } from "@/components/console/manage/opening-windows-field";

export interface ClockFieldProps {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function ClockField({ label, value, disabled, onChange }: ClockFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span aria-hidden="true" className="text-micro text-text-secondary">
        {label}
      </span>
      <OpeningTime label={label} value={value} disabled={disabled} onChange={onChange} />
    </div>
  );
}
