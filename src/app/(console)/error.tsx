"use client";

import { useEffect } from "react";
import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";

export default function ConsoleError({ error, retry }: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => { console.error("[console] screen failed:", error); }, [error]);

  return (
    <main className="mx-auto w-full max-w-console px-4 py-6 sm:px-6">
      <ActionError
        title="This screen could not be loaded"
        message="We could not display the latest information. If you were saving a change, check the record after reloading before trying that change again."
        remedy="Reload this screen. If the problem continues, ask Management for help."
      >
        <Button type="button" className="min-h-tap" onClick={retry}>Reload this screen</Button>
      </ActionError>
    </main>
  );
}
