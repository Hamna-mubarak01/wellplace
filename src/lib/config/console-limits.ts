export const CLEANING_BUFFER_MINUTES = { min: 0, max: 24 * 60, step: 5 } as const;
export const LATE_ARRIVAL_MINUTES = { min: 0, max: 12 * 60, step: 5 } as const;
export const OVERRUN_MINUTES = { min: 0, max: 12 * 60, step: 5 } as const;
export const RESCHEDULE_MINUTES = { min: 1, max: 24 * 60 * 366 } as const;
export const EXTENSION_MINUTES = { min: 1, max: 24 * 60, step: 1 } as const;

export const CONSOLE_MONEY_AED = { min: 0, max: 100_000, step: 0.01 } as const;

export const REASON_MAX_LENGTH = 500;
export const RECEPTION_IDENTITY_LIMITS = { nameMaxLength: 80, emailMaxLength: 254, phoneMaxDigits: 15 } as const;
export const TASK_TITLE_MAX_LENGTH = 120;
export const TASK_NOTE_MAX_LENGTH = 1_000;
export const SHIFT_NOTE_MAX_LENGTH = 2_000;
export const BOOKING_NOTE_MAX_LENGTH = 2_000;
export const GUEST_WARNING_MAX_LENGTH = 1_000;
export const SPECIAL_REQUEST_MAX_LENGTH = 1_000;
export const ALERT_NOTE_MAX_LENGTH = 500;
export const CLEANING_NOTE_MAX_LENGTH = 500;
export const PAYMENT_REFERENCE_MAX_LENGTH = 64;
export const PAYMENT_NOTE_MAX_LENGTH = 500;
export const VOUCHER_CODE_MAX_LENGTH = 64;

export const MESSAGE_TIMING_MAX = { minutes: 1_440, hours: 168, days: 90 } as const;

export const COUNTER_VISIBLE_AT_REMAINING = 50;

export function clampNumber(value: number, bounds: { min: number; max: number }): number {
  return Math.min(bounds.max, Math.max(bounds.min, value));
}
