import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/shared/button";

export const metadata = {
  title: "Receipt link unavailable",
  robots: { index: false, follow: false },
};

export default function ReceiptNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-h1">
            <h1>This receipt link no longer works</h1>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-pretty text-text-secondary">
            This link is invalid, has expired or was withdrawn. Contact
            WellPlace if you still need a copy of your receipt, or start a
            new booking.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/book">Book a visit</Link>
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
