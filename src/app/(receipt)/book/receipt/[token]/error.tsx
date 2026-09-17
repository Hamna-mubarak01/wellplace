"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/shared/button";

export default function ReceiptError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[receipt] screen failed:", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-h1">
            <h1>This receipt could not be loaded</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="gap-2 border-danger-border bg-danger-wash p-4 text-danger-ink sm:p-5">
            <TriangleAlertIcon aria-hidden="true" className="size-5" />
            <AlertTitle className="text-body font-semibold text-danger-ink">
              We could not display this page
            </AlertTitle>
            <AlertDescription className="text-body text-danger-ink">
              <span>
                This page failed to load. Your booking and payment are not
                changed by this. If you paid, the confirmation email shows
                whether your booking is confirmed.
              </span>
              {error.digest && (
                <span className="mt-2 block font-data text-fine tabular-nums">
                  Reference {error.digest}
                </span>
              )}
            </AlertDescription>
          </Alert>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={retry}>
              <RotateCcwIcon aria-hidden="true" className="size-4" />
              Try again
            </Button>
            <Button variant="outline" asChild>
              <Link href="/contact">Contact WellPlace</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
