import {
  CalendarIcon,
  ClockIcon,
  HomeIcon,
  ImageIcon,
  LayersIcon,
  ListIcon,
  MapPinIcon,
  MegaphoneIcon,
  MessageSquareIcon,
  PhoneIcon,
  ScaleIcon,
  SearchIcon,
  SettingsIcon,
  Share2Icon,
  SparklesIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

import type { CmsIconName } from "@/lib/config/cms/types";

const ICONS: Readonly<Record<CmsIconName, LucideIcon>> = {
  home: HomeIcon,
  sparkles: SparklesIcon,
  layers: LayersIcon,
  calendar: CalendarIcon,
  message: MessageSquareIcon,
  megaphone: MegaphoneIcon,
  phone: PhoneIcon,
  search: SearchIcon,
  settings: SettingsIcon,
  scale: ScaleIcon,
  image: ImageIcon,
  list: ListIcon,
  map: MapPinIcon,
  share: Share2Icon,
  clock: ClockIcon,
  users: UsersRoundIcon,
};

export function cmsIcon(name: CmsIconName): LucideIcon {
  return ICONS[name];
}

export function CmsIcon({
  name,
  className,
}: {
  name: CmsIconName;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" className={className} />;
}
