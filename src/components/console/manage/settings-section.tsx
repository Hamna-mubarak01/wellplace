import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function SettingsSection({ children, title }: { children: ReactNode; title?: string }) {
  return <Card className="settings-section gap-0 border border-border bg-surface-raised py-0 text-text-primary shadow-none ring-0"><CardContent className="flex min-w-0 flex-col gap-4 p-5">{title && <h3 className="text-console-body font-medium">{title}</h3>}{children}</CardContent></Card>;
}
