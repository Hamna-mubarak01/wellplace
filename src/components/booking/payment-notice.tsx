import { CircleAlertIcon, ClockIcon, InfoIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export type PaymentNoticeKind = "failed" | "cancelled" | "pending" | "expired";

const NOTICE: Readonly<Record<PaymentNoticeKind, { title: string; body: string; tone: "danger" | "info" }>> = {
  failed: {
    title: "Your payment was declined",
    body: "No money was charged. Check your details and try again while your time is still held.",
    tone: "danger",
  },
  cancelled: {
    title: "Your payment was cancelled",
    body: "No money was charged. You can start the payment again while your time is still held.",
    tone: "info",
  },
  pending: {
    title: "Your payment is still being checked",
    body: "Please wait a moment and try again. You will not be charged twice.",
    tone: "info",
  },
  expired: {
    title: "Your time is no longer held",
    body: "The hold on your time ended before payment finished. Choose a time again to continue. If a payment did go through, we will email you straight away.",
    tone: "danger",
  },
};

export function PaymentNotice({ kind }: { kind: PaymentNoticeKind }) {
  const notice = NOTICE[kind];
  const Icon = kind === "pending" ? ClockIcon : notice.tone === "danger" ? CircleAlertIcon : InfoIcon;
  return (
    <Alert
      role={notice.tone === "danger" ? "alert" : "status"}
      className={
        notice.tone === "danger"
          ? "mb-5 border-danger-border bg-danger-wash text-danger-ink"
          : "mb-5 border-info-border bg-info-wash text-info-ink"
      }
    >
      <Icon aria-hidden="true" />
      <AlertTitle>{notice.title}</AlertTitle>
      <AlertDescription className="text-current">{notice.body}</AlertDescription>
    </Alert>
  );
}
