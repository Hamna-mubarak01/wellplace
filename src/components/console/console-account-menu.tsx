"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { toast } from "@/lib/console/feedback";
import { signOut } from "@/app/(console)/sign-in/actions";
import { initialsFor } from "@/components/console/console-nav";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/shared/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function ConsoleAccountMenu({fullName,email}:{fullName:string;email:string}) {
  const router = useRouter();
  const [, startSignOut] = useTransition();
  return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Account menu for ${fullName}`}
              className="size-tap rounded-full"
            >
              <Avatar className="size-9">
                <AvatarFallback className="bg-brand font-data text-pill font-semibold text-on-brand">
                  {initialsFor(fullName)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" sideOffset={8} className="w-64">
            <DropdownMenuLabel className="flex items-center gap-2.5 font-normal">
              <Avatar className="size-9 shrink-0">
                <AvatarFallback className="bg-brand font-data text-pill font-semibold text-on-brand">
                  {initialsFor(fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-console-body font-medium text-text-primary">
                  {fullName}
                </span>
                <span className="truncate text-micro text-text-muted">
                  {email}
                </span>
              </span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="min-h-tap"
              onSelect={() =>
                startSignOut(async () => {
                  const result = await signOut();
                  if (!result.ok) {
                    toast.error("Could not sign out", { description: result.message });
                    return;
                  }
                  router.replace("/sign-in");
                  router.refresh();
                })
              }
            >
              <LogOutIcon aria-hidden="true" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
  );
}
