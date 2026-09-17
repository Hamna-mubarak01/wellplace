import { Skeleton } from "@/components/ui/skeleton";

export default function MessageEditorLoading() {
  return (
    <main aria-busy="true" className="flex h-dvh flex-col bg-surface-sunken">
      <h1 className="sr-only">Loading message editor</h1>
      <div className="flex items-center justify-between border-b border-border bg-surface-raised p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-tap w-28" />
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-editor-rail shrink-0 space-y-6 border-r border-border bg-surface-raised p-4 md:block">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </aside>
        <div className="min-w-0 flex-1 p-6">
          <div className="w-full space-y-8 bg-surface-raised p-8">
            <Skeleton className="mx-auto h-8 w-36" />
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
