import type { ReactNode } from "react";
import { StickyNoteIcon } from "lucide-react";

import { DetailSection } from "@/components/console/shared/detail-section";
import { DetailField } from "@/components/console/shared/detail-field";

export interface BookingNotesSectionProps {
  personalRequest: string | null;
  internalNote: string | null;
  action?: ReactNode;
}

export function BookingNotesSection({ personalRequest, internalNote, action }: BookingNotesSectionProps) {
  return (
    <DetailSection title="Notes" Icon={StickyNoteIcon} actions={action} className="h-full">
      <dl className="flex flex-col gap-4">
        <DetailField
          label="Special request"
          value={personalRequest ? <span className="whitespace-pre-wrap text-pretty">{personalRequest}</span> : null}
          emptyLabel="The guest asked for nothing in particular"
        />
        <DetailField
          label="Internal note"
          value={internalNote ? <span className="whitespace-pre-wrap text-pretty">{internalNote}</span> : null}
          emptyLabel="No internal note"
        />
      </dl>
    </DetailSection>
  );
}
