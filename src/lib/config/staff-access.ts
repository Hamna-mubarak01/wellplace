
export const INVITE_LINK_MINUTES = 24 * 60;

export const INVITE_VALID_HOURS = 24;

export function inviteLinkLifetimeLabel(): string {
  if (INVITE_LINK_MINUTES % 60 === 0) {
    const hours = INVITE_LINK_MINUTES / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return `${INVITE_LINK_MINUTES} minutes`;
}

export const STAFF_INPUT_LIMITS = { name: 120, email: 254 } as const;
