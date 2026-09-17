"use client";

import { useEffect } from "react";
import { RotateCcwIcon } from "lucide-react";

import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";

export default function ReceptionError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[reception] screen failed:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-console flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <ActionError
        title="This screen could not be loaded"
        message="We could not display the latest information. If you were saving a change, check the record after reloading before trying that change again."
        remedy="Try reloading this screen. If the problem continues, ask Management for help."
      >
        {error.digest && (
          <p className="mt-2 font-data text-micro tabular-nums text-danger-ink">
            Reference {error.digest}
          </p>
        )}
        <Button type="button" onClick={retry} className="mt-4 min-h-tap">
          <RotateCcwIcon aria-hidden="true" className="size-4" />
          Try again
        </Button>
      </ActionError>
    </main>
  );
}
