import { CalendarCheckIcon, CalendarClockIcon, CalendarDaysIcon, HistoryIcon, WalletIcon } from "lucide-react";

import { formatDubaiDate } from "@/components/console/manage/customers/customer-view";
import { StatCard } from "@/components/console/shared/stat-card";
import { StatGrid } from "@/components/console/shared/stat-grid";
import { formatAed } from "@/components/shared/money";
import type { ManagementCustomer } from "@/lib/db/queries/management-customers";

export interface CustomerRecordStatsProps {
  customer: ManagementCustomer;
}

export function CustomerRecordStats({ customer }: CustomerRecordStatsProps) {
  const lastVisit = formatDubaiDate(customer.lastVisitAt);
  const firstVisit = formatDubaiDate(customer.firstVisitAt);
  const nextVisit = formatDubaiDate(customer.nextVisitAt);

  return (
    <StatGrid columns={5} label="Customer summary">
      <StatCard
        label="Bookings"
        value={customer.bookingsCount}
        sub={`${customer.cancelledCount.toLocaleString("en-AE")} cancelled`}
        Icon={CalendarDaysIcon}
      />
      <StatCard
        label="Completed"
        value={customer.completedCount}
        sub={firstVisit === "" ? "No visits yet" : `First visit ${firstVisit}`}
        tone={customer.completedCount > 0 ? "success" : "neutral"}
        Icon={CalendarCheckIcon}
      />
      <StatCard
        label="Upcoming"
        value={customer.upcomingCount}
        sub={nextVisit === "" ? "Nothing booked" : `Next ${nextVisit}`}
        tone={customer.upcomingCount > 0 ? "info" : "neutral"}
        Icon={CalendarClockIcon}
      />
      <StatCard label="Paid total" value={formatAed(customer.paidFils, { compact: true })} sub="Net of refunds returned" Icon={WalletIcon} />
      <StatCard label="Last visit" value={lastVisit === "" ? "None" : lastVisit} Icon={HistoryIcon} />
    </StatGrid>
  );
}
