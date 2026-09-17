import { cn } from "@/lib/utils";

export interface EmptyValueProps {
  label?: string;
  className?: string;
}

export function EmptyValue({ label = "Not recorded", className }: EmptyValueProps) {
  return (
    <span className={cn("text-text-muted", className)}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
