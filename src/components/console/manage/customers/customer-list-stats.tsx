import { CalendarClockIcon, StarIcon, UsersRoundIcon } from "lucide-react";

import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { MANAGEMENT_LIST } from "@/lib/config/management-lists";
import type { CustomerTotals } from "@/lib/db/queries/customers-page";

export interface CustomerListStatsProps {
  totals: CustomerTotals;
  hrefs: {
    readonly all: string;
    readonly returning: string;
    readonly upcoming: string;
  };
  selected: "returning" | "upcoming" | null;
}

export function CustomerListStats({ totals, hrefs, selected }: CustomerListStatsProps) {
  return (
    <StatGrid columns={3} label="Customer totals">
      <StatCard
        label="Customers"
        value={totals.customers}
        sub="Booked at least once"
        Icon={UsersRoundIcon}
        href={hrefs.all}
        selected={selected === null}
      />
      <StatCard
        label="Returning"
        value={totals.returning}
        sub={`${MANAGEMENT_LIST.returningCompletedVisits} or more completed visits`}
        tone="success"
        Icon={StarIcon}
        href={hrefs.returning}
        selected={selected === "returning"}
      />
      <StatCard
        label="Upcoming visits"
        value={totals.upcoming}
        sub="Customers with a visit booked"
        tone="info"
        Icon={CalendarClockIcon}
        href={hrefs.upcoming}
        selected={selected === "upcoming"}
      />
    </StatGrid>
  );
}
