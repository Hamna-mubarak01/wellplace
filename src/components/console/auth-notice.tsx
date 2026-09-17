import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type AuthNoticeTone = "danger" | "warning";

export interface AuthNoticeProps {
  tone: AuthNoticeTone;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthNotice({ tone, title, children, className }: AuthNoticeProps) {
  return (
    <Alert
      className={cn(
        tone === "danger"
          ? "border-danger-border bg-danger-wash text-danger-ink"
          : "border-warning-border bg-warning-wash text-warning-ink",
        className,
      )}
    >
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription
        className={tone === "danger" ? "text-danger-ink/90" : "text-warning-ink/90"}
      >
        {children}
      </AlertDescription>
    </Alert>
  );
}
