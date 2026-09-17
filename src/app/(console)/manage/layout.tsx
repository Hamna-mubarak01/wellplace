import type { CSSProperties } from "react";

import { requireManagement } from "@/lib/auth/session";
import { ConsoleHeader } from "@/components/console/console-header";
import { ConsoleSidebar } from "@/components/console/console-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ManagementFrame } from "@/components/console/manage/management-frame";

const SIDEBAR_SIZE = {
  "--sidebar-width-icon": "var(--measure-console-sidebar-icon)",
} as CSSProperties;

export default async function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireManagement();

  return (
    <ManagementFrame
      shell={
        <SidebarProvider style={SIDEBAR_SIZE}>
          <ConsoleSidebar
            viewer={{ role: session.role, permissions: session.permissions }}
            consoleId="manage"
          />

          <SidebarInset
            data-console="manage"
            className="min-w-0 bg-surface-base"
          >
            <ConsoleHeader
              fullName={session.fullName}
              email={session.email}
              consoleId="manage"
            />
            <div className="min-w-0 flex-1">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      }
    >
      {children}
    </ManagementFrame>
  );
}
