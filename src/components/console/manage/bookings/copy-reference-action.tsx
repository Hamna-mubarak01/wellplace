"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { ConsoleIconAction } from "@/components/console/shared/console-icon-action";
import { toast } from "@/lib/console/feedback";

export interface CopyReferenceActionProps {
  reference: string;
}

export function CopyReferenceAction({ reference }: CopyReferenceActionProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      toast.success("Reference copied", { description: reference });
    } catch {
      toast.error("The reference could not be copied", {
        description: "Select the reference in the page title and copy it instead.",
      });
    }
  };

  return (
    <ConsoleIconAction
      label={copied ? `Reference ${reference} copied` : `Copy reference ${reference}`}
      Icon={copied ? CheckIcon : CopyIcon}
      variant="ghost"
      onClick={copy}
      onBlur={() => setCopied(false)}
    />
  );
}
