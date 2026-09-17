
export const PUBLIC_BRAND = "WellPlace";

export const LEGAL_ENTITY_PUBLIC = "WellPlace Demo";

export const PRIVACY_CONTACT = "privacy@wellplace.example";

export const VENUE_ADDRESS_LINES = [
  "Lantern Court",
  "48 Marina Walk",
  "Business Bay",
  "Dubai, United Arab Emirates",
] as const;

export const VENUE_LOCALITY = "Business Bay · Dubai";

export const VENUE_MAP_QUERY = VENUE_ADDRESS_LINES.join(", ");

export const VENUE_MAP_CENTER = [25.1857, 55.2766] as const;
export const VENUE_MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const VENUE_MAP_ATTRIBUTION_LABEL = " ";
export const VENUE_MAP_ATTRIBUTION_LINK = "https://www.openstreetmap.org/copyright";
export const VENUE_MAP_TILE_MAX_ZOOM = 19;
export const VENUE_MAP_ZOOM = 16;
export const VENUE_MAP_PRELOAD_MARGIN = "320px";

export const VENUE_MAP_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  VENUE_MAP_QUERY,
)}`;

export const VENUE_DIRECTIONS_LINK = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
  VENUE_MAP_QUERY,
)}`;
