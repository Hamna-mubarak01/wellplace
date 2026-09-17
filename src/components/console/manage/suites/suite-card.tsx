import { ConsoleCard } from "@/components/console/console-surface";
import { StatusChip } from "@/components/console/shared/status-chip";
import { SuiteCardLink } from "@/components/console/manage/suites/suite-card-link";
import { LIVE_STATE_TONE } from "@/components/console/manage/suites/suite-tones";
import type { ManagedSuite } from "@/lib/db/queries/suite-inventory";
import {
  LIVE_STATE_LABEL,
  liveState,
  suiteName,
  suiteStatusLine,
} from "@/app/(console)/manage/suites/suites-view";

export interface SuiteCardProps {
  suite: ManagedSuite;
  now: Date;
}

function bookingsToday(count: number): string {
  if (count === 0) return "No bookings today";
  return count === 1 ? "1 booking today" : `${count.toLocaleString("en-AE")} bookings today`;
}

export function SuiteCard({ suite, now }: SuiteCardProps) {
  const live = liveState(suite);
  const name = suiteName(suite);
  const titleId = `suite-${suite.id}`;

  return (
    <li className="min-w-0">
      <ConsoleCard
        aria-labelledby={titleId}
        className="relative flex h-full min-w-0 flex-col items-center gap-3 p-5 text-center transition-[border-color,box-shadow] duration-150 hover:border-border-hover hover:shadow-(--shadow-card-hover) has-[a:focus-visible]:border-border-hover has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-focus-ring motion-reduce:transition-none"
      >
        <h2 id={titleId} className="min-w-0">
          <SuiteCardLink
            suiteId={suite.id}
            className="block min-w-0 rounded-(--radius-inner) outline-none after:absolute after:inset-0 after:rounded-(--radius-card)"
          >
            <span className="block text-console-label tracking-label text-text-muted uppercase">
              Suite
            </span>
            <span className="mt-1 block font-data text-h1 leading-none tabular-nums text-text-primary">
              {suite.suiteNumber}
            </span>
          </SuiteCardLink>
        </h2>

        {name !== null && (
          <p className="min-w-0 truncate text-console-body text-text-secondary">{name}</p>
        )}

        <StatusChip tone={LIVE_STATE_TONE[live]}>{LIVE_STATE_LABEL[live]}</StatusChip>

        <div className="mt-auto w-full min-w-0 border-t border-border pt-4">
          <p className="text-console-table font-medium text-pretty text-text-primary">
            {suiteStatusLine(suite, now)}
          </p>
          <p className="mt-1 text-console-body text-text-secondary">
            {bookingsToday(suite.bookingsToday)}
          </p>
        </div>
      </ConsoleCard>
    </li>
  );
}
