export interface ReferenceParts {
  readonly primary: string | null;
  readonly secondary: string | null;
}

export function referenceParts(
  reference: string | null | undefined,
  secondary: string | null | undefined,
): ReferenceParts {
  const primary = reference ?? secondary ?? null;
  return { primary, secondary: reference && secondary ? secondary : null };
}
