"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcwIcon } from "lucide-react";

import { ActionError } from "@/components/shared/action-error";
import { Button } from "@/components/shared/button";

export default function ManageSuitesError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[manage/suites] screen failed:", error);
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-console flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <ActionError
        title="Suites could not be shown"
        message="The latest suite information could not be displayed. If you were changing a suite, open it again after reloading and check the change before trying it again."
        remedy="Try again. If the problem continues, ask for help."
      >
        {error.digest && (
          <p className="font-data text-micro tabular-nums text-danger-ink">Reference {error.digest}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={retry}>
            <RotateCcwIcon aria-hidden="true" className="size-4" />
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/manage/suites">All suites</Link>
          </Button>
        </div>
      </ActionError>
    </div>
  );
}
