import { GlobeIcon } from "lucide-react";

import { resolveSocialIcon, SOCIAL_ICON_ASSETS } from "@/lib/config/social-icons";
import { cn } from "@/lib/utils";

export function SocialIcon({ name, className }: { name: string; className?: string }) {
  const icon = resolveSocialIcon(name);
  if (icon === "website") return <GlobeIcon aria-hidden="true" className={cn("size-5", className)} />;
  const mask = `url("${SOCIAL_ICON_ASSETS[icon]}") center / contain no-repeat`;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-5 shrink-0 bg-current", className)}
      style={{ mask, WebkitMask: mask }}
    />
  );
}
