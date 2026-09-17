import { requireReception } from "@/lib/auth/session";
import { ReceptionAutoRefresh } from "@/components/console/reception/auto-refresh";
import { ReceptionValidation } from "@/components/console/reception/reception-validation";
import { ReceptionHeader } from "@/components/console/reception/reception-header";

export default async function ReceptionLayout({ children }: { children: React.ReactNode }) {
  const session = await requireReception();
  return <ReceptionValidation><div data-console="reception" className="flex min-h-dvh min-w-0 flex-1 flex-col bg-surface-base">
    <ReceptionAutoRefresh />
    <ReceptionHeader fullName={session.fullName} email={session.email} viewer={{role:session.role, permissions:session.permissions}} />
    <main className="min-w-0 flex-1">{children}</main>
  </div></ReceptionValidation>;
}
