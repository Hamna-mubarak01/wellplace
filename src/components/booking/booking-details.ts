import {
  calculateAge,
  type DateOfBirthValue,
} from "@/components/shared/dob-select";
import { type PhoneValue } from "@/components/shared/phone-input";


export type Salutation = "mr" | "ms";

export interface BookingDetails {
  readonly salutation: Salutation | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: DateOfBirthValue;
  readonly email: string;
  readonly phone: PhoneValue;
}

export type DetailsField = keyof BookingDetails;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateDetailsField(
  field: DetailsField,
  details: BookingDetails,
  bookerMinAge: number,
  today: Date = new Date(),
): string | null {
  switch (field) {
    case "salutation":
      return details.salutation === null ? "Choose Mr. or Ms." : null;

    case "firstName":
      return details.firstName.trim() === "" ? "Enter your first name." : null;

    case "lastName":
      return details.lastName.trim() === "" ? "Enter your last name." : null;

    case "email": {
      const email = details.email.trim();
      if (email === "") return "Enter an email address we can send the booking to.";
      if (!EMAIL_SHAPE.test(email)) {
        return "Enter a complete email address, for example name@example.com.";
      }
      return null;
    }

    case "dateOfBirth": {
      const { day, month, year } = details.dateOfBirth;
      if (day === null || month === null || year === null) {
        return "Choose the day, month and year you were born.";
      }
      const age = calculateAge(details.dateOfBirth, today);
      if (age !== null && age < bookerMinAge) {
        return `The person making the booking has to be ${bookerMinAge} or over.`;
      }
      return null;
    }

    case "phone":
      return details.phone.nationalNumber.trim() === ""
        ? "Enter a mobile number we can reach you on."
        : null;
  }
}

export const DETAILS_FIELDS = [
  "salutation",
  "firstName",
  "lastName",
  "dateOfBirth",
  "email",
  "phone",
] as const satisfies readonly DetailsField[];

export function validateDetails(
  details: BookingDetails,
  bookerMinAge: number,
  today: Date = new Date(),
): Partial<Record<DetailsField, string>> {
  const errors: Partial<Record<DetailsField, string>> = {};
  for (const field of DETAILS_FIELDS) {
    const message = validateDetailsField(field, details, bookerMinAge, today);
    if (message) errors[field] = message;
  }
  return errors;
}

export function detailsComplete(
  details: BookingDetails,
  bookerMinAge: number,
  today: Date = new Date(),
): boolean {
  return Object.keys(validateDetails(details, bookerMinAge, today)).length === 0;
}
