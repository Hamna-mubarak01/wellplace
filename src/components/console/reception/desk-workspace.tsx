import { DeskUpdates, type DeskUpdatesProps } from "@/components/console/reception/desk-updates";

type DeskWorkspaceProps = {
  toolbar: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
} & ({ updates: React.ReactNode } | DeskUpdatesProps);

export function DeskWorkspace(props: DeskWorkspaceProps) {
  return <>
    <div className="reception-desk-toolbar">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{props.toolbar}</div>
      <div className="reception-desk-actions">
        {props.actions}
        {"updates" in props ? props.updates : <DeskUpdates {...props} />}
      </div>
    </div>
    <section aria-label="Suite schedule" className="min-w-0">{props.children}</section>
  </>;
}
