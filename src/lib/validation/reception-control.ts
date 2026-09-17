export interface ReceptionControlRules {
  numeric?: boolean;
  min?: number;
  max?: number;
  step?: number;
  maxLength?: number;
  required?: boolean;
}

export function receptionControlError(value: string, rules: ReceptionControlRules, commit = false): string | null {
  if (rules.maxLength !== undefined && value.length > rules.maxLength) return `Use ${rules.maxLength} characters or fewer.`;
  if (!value.trim()) return commit && rules.required ? "This field is required." : null;
  if (!rules.numeric) return null;
  const decimal = rules.step !== undefined && !Number.isInteger(rules.step);
  if (!(decimal ? /^-?\d*(?:\.\d*)?$/ : /^-?\d*$/).test(value)) return decimal ? "Enter an amount using numbers and a decimal point." : "Enter a whole number.";
  if (/^-?\.?$/.test(value)) return commit ? "Enter a number." : null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Enter a valid number.";
  if (rules.max !== undefined && amount > rules.max) return `The maximum is ${rules.max.toLocaleString("en-US")}.`;
  if (rules.min !== undefined && (commit || amount < 0) && amount < rules.min) return `The minimum is ${rules.min.toLocaleString("en-US")}.`;
  if (decimal && rules.step !== undefined) {
    const places = String(rules.step).split(".")[1]?.length ?? 0;
    if ((value.split(".")[1]?.length ?? 0) > places) return `Use no more than ${places} decimal places.`;
  }
  return null;
}
