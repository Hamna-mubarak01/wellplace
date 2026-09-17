import type { StatusChipTone } from "@/components/console/shared/status-chip";
import type { LiveState } from "@/app/(console)/manage/suites/suites-view";

export const LIVE_STATE_TONE: Readonly<Record<LiveState, StatusChipTone>> = {
  available: "success",
  checkout_hold: "warning",
  booked: "brand",
  checked_in: "success",
  cleaning: "info",
  blocked: "danger",
  maintenance: "warning",
  not_ready: "warning",
  out_of_service: "danger",
  retired: "neutral",
};

export const TONE_DOT: Readonly<Record<StatusChipTone, string>> = {
  neutral: "bg-text-muted",
  brand: "bg-brand",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};
