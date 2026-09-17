export interface AddonEligibility {
  eligibleMinGuests?: number | null;
  eligibleMaxGuests?: number | null;
  eligibleMinHours?: number | null;
  eligibleMaxHours?: number | null;
}

export function addonAvailabilityMessage(item: AddonEligibility, guests: number, hours: number): string | null {
  if (item.eligibleMinGuests != null && guests < item.eligibleMinGuests) return `Available for ${item.eligibleMinGuests} or more guests.`;
  if (item.eligibleMaxGuests != null && guests > item.eligibleMaxGuests) return `Available for up to ${item.eligibleMaxGuests} guests.`;
  if (item.eligibleMinHours != null && hours < item.eligibleMinHours) return `Available for visits of ${item.eligibleMinHours} hours or longer.`;
  if (item.eligibleMaxHours != null && hours > item.eligibleMaxHours) return `Available for visits of up to ${item.eligibleMaxHours} hours.`;
  return null;
}
