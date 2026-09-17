import { createElement } from "react";

import {
  BathIcon,
  CalendarIcon,
  CheckIcon,
  Clock3Icon,
  DoorOpenIcon,
  DropletIcon,
  FlameIcon,
  HeartIcon,
  HomeIcon,
  HourglassIcon,
  KeyRoundIcon,
  LeafIcon,
  LockIcon,
  MapPinIcon,
  MessageSquareIcon,
  MoonIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  SunIcon,
  UsersRoundIcon,
  WavesIcon,
  WindIcon,
  type LucideIcon,
} from "lucide-react";

import {
  DEFAULT_CONTENT_ICON,
  isContentIcon,
  type ContentIconName,
} from "@/lib/config/cms/icons";

const ICONS: Readonly<Record<ContentIconName, LucideIcon>> = {
  key: KeyRoundIcon,
  lock: LockIcon,
  shield: ShieldIcon,
  clock: Clock3Icon,
  hourglass: HourglassIcon,
  calendar: CalendarIcon,
  users: UsersRoundIcon,
  heart: HeartIcon,
  sparkles: SparklesIcon,
  leaf: LeafIcon,
  flame: FlameIcon,
  droplet: DropletIcon,
  waves: WavesIcon,
  sun: SunIcon,
  moon: MoonIcon,
  wind: WindIcon,
  bath: BathIcon,
  door: DoorOpenIcon,
  home: HomeIcon,
  "map-pin": MapPinIcon,
  phone: MessageSquareIcon,
  message: MessageSquareIcon,
  star: StarIcon,
  check: CheckIcon,
};

export function contentIcon(name: string): LucideIcon {
  return ICONS[isContentIcon(name) ? name : DEFAULT_CONTENT_ICON];
}

export function ContentIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return createElement(contentIcon(name), { "aria-hidden": true, className });
}
