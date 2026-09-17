import { IdCardIcon } from "lucide-react";

import {
  ageToday,
  countryName,
  formatCalendarDate,
  formatDubaiDate,
  formatPhone,
  salutationLabel,
} from "@/components/console/manage/customers/customer-view";
import { DetailField } from "@/components/console/shared/detail-field";
import { DetailFieldGrid } from "@/components/console/shared/detail-field-grid";
import { DetailSection } from "@/components/console/shared/detail-section";
import type { ManagementCustomer } from "@/lib/db/queries/management-customers";
import { formatDubaiDateTime } from "@/lib/domain/time";

export interface CustomerProfileSectionProps {
  customer: ManagementCustomer;
}

function birthValue(dateOfBirth: string | null): string | null {
  if (dateOfBirth === null) return null;
  const date = formatCalendarDate(dateOfBirth);
  if (date === "") return null;
  const age = ageToday(dateOfBirth);
  return age === null ? date : `${date} · Age ${age}`;
}

export function CustomerProfileSection({ customer }: CustomerProfileSectionProps) {
  const phone = formatPhone(customer.phoneE164);
  const internalNote = customer.internalNote?.trim() ?? "";

  return (
    <DetailSection title="Personal information" Icon={IdCardIcon}>
      <DetailFieldGrid columns={4}>
        <DetailField label="Salutation" value={salutationLabel(customer.salutation)} emptyLabel="Not given" />
        <DetailField label="First name" value={customer.firstName.trim()} emptyLabel="Not given" />
        <DetailField label="Last name" value={customer.lastName.trim()} emptyLabel="Not given" />
        <DetailField label="Date of birth" value={birthValue(customer.dateOfBirth)} emptyLabel="Not given" />
        <DetailField
          label="Email"
          span={2}
          value={customer.email === "" ? null : <span className="break-all">{customer.email}</span>}
          emptyLabel="Not given"
        />
        <DetailField label="Phone" value={phone} emptyLabel="Not given" data />
        <DetailField label="Phone country" value={countryName(customer.phoneCountry)} emptyLabel="Not given" />
        <DetailField label="Customer since" value={formatDubaiDate(customer.createdAt)} />
        <DetailField label="Last interaction" value={formatDubaiDateTime(customer.lastInteractionAt)} />
        <DetailField
          label="Internal note"
          span="full"
          value={internalNote === "" ? null : <span className="whitespace-pre-wrap font-normal">{internalNote}</span>}
          emptyLabel="No note"
        />
      </DetailFieldGrid>
    </DetailSection>
  );
}
