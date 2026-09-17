"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/shared/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  COUNTRIES,
  DEFAULT_COUNTRY_ISO2,
  findCountry,
  type Country,
} from "@/components/shared/countries";

const FLAG_WIDTH = 22;
const FLAG_HEIGHT = 15;

function Flag({ country }: { country: Country }) {
  return (
    <Image
      src={country.flagSrc}
      alt=""
      aria-hidden="true"
      width={FLAG_WIDTH}
      height={FLAG_HEIGHT}
      unoptimized
      className="shrink-0 rounded-xs object-cover ring-1 ring-border"
    />
  );
}

export interface PhoneValue {
  countryIso2: string;
  dialCode: string;
  nationalNumber: string;
}

export function emptyPhoneValue(
  countryIso2: string = DEFAULT_COUNTRY_ISO2,
): PhoneValue {
  const country =
    findCountry(countryIso2) ?? findCountry(DEFAULT_COUNTRY_ISO2);
  const resolved = country as Country;
  return {
    countryIso2: resolved.iso2,
    dialCode: resolved.dialCode,
    nationalNumber: "",
  };
}

export function toE164(value: PhoneValue): string {
  return value.nationalNumber ? `${value.dialCode}${value.nationalNumber}` : "";
}

export interface PhoneInputProps {
  id: string;
  label: string;
  value: PhoneValue;
  onChange: (value: PhoneValue) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

export function PhoneInput({
  id,
  label,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  placeholder = "50 123 4567",
  className,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => findCountry(value.countryIso2) ?? findCountry(DEFAULT_COUNTRY_ISO2)!,
    [value.countryIso2],
  );

  function handleSelectCountry(country: Country) {
    onChange({ ...value, countryIso2: country.iso2, dialCode: country.dialCode });
    setOpen(false);
  }

  function handleNumberChange(raw: string) {
    onChange({ ...value, nationalNumber: raw.replace(/\D/g, "") });
  }

  const errorId = error ? `${id}-error` : undefined;

  return (
    <Field
      data-invalid={Boolean(error) || undefined}
      className={cn("gap-2", className)}
    >
      <FieldLabel
        htmlFor={id}
        className="gap-1 text-field-label font-medium text-text-secondary"
      >
        {label}
      </FieldLabel>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <InputGroup className="h-control rounded-(--radius-card) text-control gap-0 overflow-hidden bg-surface-raised">
            <InputGroupAddon align="inline-start" className="ml-0 h-full p-0">
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  aria-label={`Country code, currently ${selected.name}, ${selected.dialCode}. Change country.`}
                  className="h-full gap-2 rounded-none border-r border-border px-4 font-data text-option text-text-primary hover:bg-surface-hover aria-expanded:bg-surface-hover"
                >
                  <Flag country={selected} />
                  {selected.dialCode}
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-4 text-text-muted transition-transform group-aria-expanded/button:rotate-180"
                  />
                </Button>
              </PopoverTrigger>
            </InputGroupAddon>

            <InputGroupInput
              id={id}
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={placeholder}
              value={value.nationalNumber}
              disabled={disabled}
              required={required}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={errorId}
              onChange={(event) => handleNumberChange(event.target.value)}
              className="h-full bg-transparent px-4 font-data text-control"
            />
          </InputGroup>
        </PopoverAnchor>

        <PopoverContent
          side="bottom"
          align="start"
          sideOffset={6}
          className="max-h-(--radix-popover-content-available-height) w-(--radix-popover-trigger-width) p-0"
        >
          <Command>
            <CommandInput placeholder="Search country or code" />
            <CommandList className="max-h-64">
              <CommandEmpty>No country matches your search.</CommandEmpty>
              <CommandGroup>
                {COUNTRIES.map((country) => (
                  <CommandItem
                    key={country.iso2}
                    value={`${country.name} ${country.dialCode} ${country.iso2}`}
                    data-checked={country.iso2 === selected.iso2}
                    onSelect={() => handleSelectCountry(country)}
                  >
                    <Flag country={country} />
                    <span className="flex-1 truncate text-fine">
                      {country.name}
                    </span>
                    <span className="font-data text-micro text-text-muted">
                      {country.dialCode}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && (
        <FieldError id={errorId} className="text-micro font-medium">
          {error}
        </FieldError>
      )}
    </Field>
  );
}
