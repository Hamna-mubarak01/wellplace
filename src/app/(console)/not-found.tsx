import Link from "next/link";

import { readStaffSession } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/console";
import { Button } from "@/components/shared/button";

export default async function ConsoleNotFound() {
  const session = await readStaffSession();
  const home = session ? homeForRole(session.role) : "/sign-in";
  const label = session ? "Back to your console" : "Go to sign in";

  return (
    <main className="flex flex-1 items-center justify-center bg-surface-base px-6 py-16">
      <div className="w-full max-w-sm">
        <p className="font-data text-console-label tracking-wider text-text-muted uppercase">
          404
        </p>
        <h1 className="mt-3 text-console-title text-text-primary">
          Screen not found
        </h1>
        <p className="mt-3 text-console-body text-text-secondary">
          This address does not match a console screen.
        </p>
        <Button asChild variant="link" className="mt-6 min-h-tap underline underline-offset-4">
          <Link href={home}>{label}</Link>
        </Button>
      </div>
    </main>
  );
}
