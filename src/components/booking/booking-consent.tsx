"use client";
import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { TERMS_SEGMENTS } from "@/lib/config/consent";
export function BookingConsent({
  accepted,
  onChange,
}: {
  accepted: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="mt-6 flex items-start gap-3">
      <Checkbox
        id="booking-consent"
        checked={accepted}
        onCheckedChange={(value) => onChange(value === true)}
        aria-labelledby="booking-consent-label"
        className="mt-1"
      />
      <label
        id="booking-consent-label"
        htmlFor="booking-consent"
        className="text-small leading-relaxed"
      >
        {TERMS_SEGMENTS.map((part, index) =>
          part.href ? (
            <Link
              key={index}
              href={part.href}
              target="_blank"
              className="underline underline-offset-4"
            >
              {part.text}
            </Link>
          ) : (
            part.text
          ),
        )}
      </label>
    </div>
  );
}
