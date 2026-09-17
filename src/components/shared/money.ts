const FILS_PER_AED = 100;

const AED_AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

export interface AedFormatOptions {
  readonly compact?: boolean;
}

export function formatAed(fils: number, options: AedFormatOptions = {}): string {
  const abs = Math.abs(Math.round(fils));
  const whole = Math.floor(abs / FILS_PER_AED).toLocaleString("en-AE");
  const minor = abs % FILS_PER_AED;
  const sign = fils < 0 ? "−" : "";

  if (options.compact === true && minor === 0) return `${sign}AED ${whole}`;

  return `${sign}AED ${whole}.${String(minor).padStart(2, "0")}`;
}

export function parseAed(raw: string): number | null {
  const trimmed = raw.trim();
  if (!AED_AMOUNT.test(trimmed)) return null;
  return Math.round(Number(trimmed) * FILS_PER_AED);
}

export function toAedInput(fils: number): string {
  const abs = Math.abs(Math.round(fils));
  return `${Math.floor(abs / FILS_PER_AED)}.${String(abs % FILS_PER_AED).padStart(2, "0")}`;
}

export function aedToFils(amount: number): number {
  return Math.round(amount * FILS_PER_AED);
}
