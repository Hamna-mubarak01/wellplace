"use client";

import { NETWORK_MESSAGE } from "@/lib/console/run-action";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";

import { signOut } from "@/app/(console)/sign-in/actions";
import { Button } from "@/components/shared/button";

export interface SignOutButtonProps {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
}

export function SignOutButton({
  className,
  variant = "outline",
  size,
  label = "Sign out",
}: SignOutButtonProps) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      className={className}
      onClick={() =>
        start(async () => {
      try {
          const result = await signOut();
          if (!result.ok) {
            toast.error("Could not sign out", { description: result.message });
            return;
          }
          router.replace("/sign-in");
          router.refresh();
        
      } catch (cause) {
        console.error("[console] action response could not be confirmed", cause);
        toast.error(NETWORK_MESSAGE);
      }
    })
      }
    >
      <LogOutIcon aria-hidden="true" />
      {label}
    </Button>
  );
}
