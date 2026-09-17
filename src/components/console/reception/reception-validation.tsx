"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "@/lib/console/feedback";

function announce(id: string, message: string) {
  const element = document.getElementById(id);
  const label = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.labels?.[0]?.textContent?.trim()
    : element?.getAttribute("aria-label");
  toast.error(label ? `Check ${label.toLowerCase()}` : "Check this field", { id: `reception-field:${id}`, description: message });
}

const ValidationContext = createContext({
  errors: {} as Record<string, string>,
  reject: announce,
  clear: (() => {}) as (id: string) => void,
});

export function ReceptionValidation({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const reject = useCallback((id: string, message: string) => {
    setErrors((current) => ({ ...current, [id]: message }));
    announce(id, message);
  }, []);
  const clear = useCallback((id: string) => {
    setErrors((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);
  const value = useMemo(() => ({ errors, reject, clear }), [errors, reject, clear]);
  return <ValidationContext.Provider value={value}>{children}</ValidationContext.Provider>;
}

export const useReceptionValidation = () => useContext(ValidationContext);
