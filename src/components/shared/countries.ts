import { getCountries, getCountryCallingCode } from "libphonenumber-js";
import COUNTRY_NAMES from "react-phone-number-input/locale/en.json";

export interface Country {
  readonly iso2: string;
  readonly name: string;
  readonly dialCode: string;
  readonly flagSrc: string;
}

export const DEFAULT_COUNTRY_ISO2 = "AE";

const NAMES = COUNTRY_NAMES as Record<string, string>;

export const COUNTRIES: readonly Country[] = getCountries()
  .map((iso2) => ({
    iso2,
    name: NAMES[iso2] ?? iso2,
    dialCode: `+${getCountryCallingCode(iso2)}`,
    flagSrc: `/flags/${iso2}.svg`,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const BY_ISO2 = new Map(COUNTRIES.map((country) => [country.iso2, country]));

export function findCountry(iso2: string): Country | undefined {
  return BY_ISO2.get(iso2.toUpperCase());
}
