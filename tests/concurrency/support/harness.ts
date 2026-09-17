import { Client } from "pg";


const CONNECTION =
  process.env.WELLPLACE_TEST_DB_URL ??
  `postgres://postgres:postgres@127.0.0.1:${process.env.WELLPLACE_TEST_DB_PORT ?? "54329"}/postgres`;

interface HoldSuiteRow {
  occupancy_id: string;
  suite_id: string;
  expires_at: Date;
}

interface OccupancyRow {
  suite_id: string;
  blocked_from: Date;
  blocked_to: Date;
  kind: string;
}

export interface AttemptOutcome {
  readonly ok: boolean;
  readonly suiteId: string | null;
  readonly occupancyId: string | null;
  readonly expiresAt: Date | null;
  readonly error: string | null;
}

export async function harnessIsUp(): Promise<boolean> {
  const client = new Client({ connectionString: CONNECTION, connectionTimeoutMillis: 1500 });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

const DATABASE_LOCK_KEY = 771_050_735;

let lockClient: Client | null = null;

export async function claimDatabase(): Promise<void> {
  if (lockClient) return;
  const client = new Client({ connectionString: CONNECTION });
  await client.connect();
  await client.query("select pg_advisory_lock($1)", [DATABASE_LOCK_KEY]);
  lockClient = client;
}

export async function releaseDatabase(): Promise<void> {
  const client = lockClient;
  if (!client) return;
  lockClient = null;
  await client.query("select pg_advisory_unlock($1)", [DATABASE_LOCK_KEY]).catch(() => {});
  await client.end().catch(() => {});
}

export async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: CONNECTION });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end().catch(() => {});
  }
}

export async function resetSuites(
  options: { available?: number; unavailableStatus?: string } = {},
): Promise<void> {
  const available = options.available ?? 7;
  const status = options.unavailableStatus ?? "out_of_service";

  await withClient(async (client) => {
    await client.query("update public.bookings set occupancy_id = null");
    await client.query("delete from public.suite_occupancy");
    await client.query("update public.suites set status = 'available', is_active = true");

    if (available < 7) {
      await client.query(
        `update public.suites
            set status = $1::public.suite_status
          where suite_number in (
            select suite_number from public.suites
             order by priority desc, suite_number desc
             limit 7 - $2::int
          )`,
        [status, available],
      );
    }
  });
}

export interface RaceRequest {
  readonly startsAt: Date;
  readonly durationHours: number;
  readonly bufferMinutes: number;
  readonly holdMinutes: number;
}

export async function raceForSlot(
  count: number,
  request: RaceRequest,
): Promise<AttemptOutcome[]> {
  const clients = Array.from({ length: count }, () => new Client({ connectionString: CONNECTION }));

  try {
    await Promise.all(clients.map((client) => client.connect()));
    await Promise.all(clients.map((client) => client.query("select 1")));

    const attempts = clients.map(async (client): Promise<AttemptOutcome> => {
      try {
        const { rows } = await client.query<HoldSuiteRow>(
          `select occupancy_id, suite_id, expires_at
             from public.hold_suite($1::timestamptz, $2::int, $3::int, $4::int)`,
          [
            request.startsAt.toISOString(),
            request.durationHours,
            request.bufferMinutes,
            request.holdMinutes,
          ],
        );

        if (rows.length === 0) {
          return { ok: false, suiteId: null, occupancyId: null, expiresAt: null, error: "no_suite" };
        }

        return {
          ok: true,
          suiteId: rows[0].suite_id,
          occupancyId: rows[0].occupancy_id,
          expiresAt: rows[0].expires_at,
          error: null,
        };
      } catch (cause) {
        return {
          ok: false,
          suiteId: null,
          occupancyId: null,
          expiresAt: null,
          error: cause instanceof Error ? cause.message : String(cause),
        };
      }
    });

    return await Promise.all(attempts);
  } finally {
    await Promise.all(clients.map((client) => client.end().catch(() => {})));
  }
}

export async function activeOccupancy(): Promise<
  Array<{ suiteId: string; blockedFrom: Date; blockedTo: Date; kind: string }>
> {
  return withClient(async (client) => {
    const { rows } = await client.query<OccupancyRow>(
      `select suite_id,
              lower(blocked_period) as blocked_from,
              upper(blocked_period) as blocked_to,
              kind::text            as kind
         from public.suite_occupancy
        where is_active
        order by suite_id, blocked_from`,
    );

    return rows.map((row) => {
      if (
        !(row.blocked_from instanceof Date) ||
        !(row.blocked_to instanceof Date) ||
        typeof row.suite_id !== "string"
      ) {
        throw new TypeError(
          `activeOccupancy got a row it cannot read: ${JSON.stringify(row)}. ` +
            `An alias in the query no longer matches OccupancyRow — fix that ` +
            `rather than the assertion, which would otherwise pass vacuously.`,
        );
      }

      return {
        suiteId: row.suite_id,
        blockedFrom: row.blocked_from,
        blockedTo: row.blocked_to,
        kind: row.kind,
      };
    });
  });
}

export function overlappingPairs(
  rows: Array<{ suiteId: string; blockedFrom: Date; blockedTo: Date }>,
): Array<[number, number]> {
  const clashes: Array<[number, number]> = [];

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      if (rows[i].suiteId !== rows[j].suiteId) continue;
      if (rows[i].blockedFrom < rows[j].blockedTo && rows[j].blockedFrom < rows[i].blockedTo) {
        clashes.push([i, j]);
      }
    }
  }

  return clashes;
}

export const ALLOCATION_LOCK_EXPRESSION =
  "hashtext('wellplace.suite_allocation')::bigint";

export async function readSetting(key: string): Promise<unknown> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ value: unknown }>(
      "select value from public.settings where key = $1",
      [key],
    );
    return rows.length === 0 ? undefined : rows[0].value;
  });
}

export async function writeSetting(key: string, value: unknown): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `insert into public.settings (key, value, value_type, source_tag, description)
       values ($1, $2::jsonb, 'boolean', 'concurrency harness', 'concurrency harness')
       on conflict (key) do update set value = excluded.value`,
      [key, JSON.stringify(value)],
    );
  });
}

export async function clearCleaningTasks(): Promise<void> {
  await withClient(async (client) => {
    await client.query("delete from public.cleaning_tasks");
  });
}

export async function suiteIdsByPriority(): Promise<string[]> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `select id::text as id
         from public.suites
        where is_active
        order by priority, suite_number`,
    );
    return rows.map((row) => row.id);
  });
}

export async function leaveSuiteAwaitingCleaning(
  suiteId: string,
  dueFrom: Date,
): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `insert into public.cleaning_tasks (suite_id, status, due_from)
       values ($1::uuid, 'pending'::public.cleaning_status, $2::timestamptz)`,
      [suiteId, dueFrom.toISOString()],
    );
  });
}

export async function confirmCleaning(suiteId: string): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      `update public.cleaning_tasks
          set status = 'confirmed'::public.cleaning_status,
              confirmed_at = clock_timestamp()
        where suite_id = $1::uuid`,
      [suiteId],
    );
  });
}

export async function countAvailableSuites(request: RaceRequest): Promise<number> {
  return withClient(async (client) => {
    const { rows } = await client.query<{ remaining: number }>(
      `select remaining
         from public.count_available_suites(
           array[$1::timestamptz], $2::int, $3::int
         )`,
      [
        request.startsAt.toISOString(),
        request.durationHours,
        request.bufferMinutes,
      ],
    );
    return rows[0].remaining;
  });
}

export interface HeldAllocationLock {
  readonly waitUntilBlocked: (attempts: number) => Promise<void>;
  readonly releaseAndStamp: () => Promise<string>;
}

export async function withHeldAllocationLock<T>(
  run: (lock: HeldAllocationLock) => Promise<T>,
): Promise<T> {
  const holder = new Client({ connectionString: CONNECTION });
  await holder.connect();
  await holder.query("begin");
  await holder.query(`select pg_advisory_xact_lock(${ALLOCATION_LOCK_EXPRESSION})`);

  let released = false;

  const observer = new Client({ connectionString: CONNECTION });
  await observer.connect();

  const blockedCount = async (): Promise<number> => {
    const { rows } = await observer.query<{ blocked: number }>(
      `select count(*)::int as blocked
         from pg_locks
        where locktype = 'advisory'
          and not granted`,
    );
    return rows[0].blocked;
  };

  const lock: HeldAllocationLock = {
    waitUntilBlocked: async (attempts: number) => {
      for (let poll = 0; poll < 2_000; poll++) {
        if ((await blockedCount()) >= attempts) return;
      }
      throw new Error(
        `withHeldAllocationLock: only ${await blockedCount()} of ${attempts} attempts ` +
          `queued behind the venue-wide allocation lock. Either the allocator no longer ` +
          `takes it first, or the attempts never reached it — do not relax this into a sleep.`,
      );
    },
    releaseAndStamp: async () => {
      const { rows } = await holder.query<{ at: string }>(
        "select clock_timestamp()::text as at",
      );
      await holder.query("rollback");
      released = true;
      return rows[0].at;
    },
  };

  try {
    return await run(lock);
  } finally {
    if (!released) await holder.query("rollback").catch(() => {});
    await holder.end().catch(() => {});
    await observer.end().catch(() => {});
  }
}

export async function requireSeededReferenceData(): Promise<void> {
  const counts = await withClient(async (client) => {
    const { rows } = await client.query<{ suites: number; settings: number }>(
      `select (select count(*)::int from public.suites)   as suites,
              (select count(*)::int from public.settings) as settings`,
    );
    return rows[0];
  });

  if (counts.suites === 0 || counts.settings === 0) {
    throw new Error(
      `The local database is reachable but holds ${counts.suites} suites and ` +
        `${counts.settings} settings. Reference data has not been loaded, so every ` +
        `assertion below would fail for the wrong reason. Run: npm run db:seed`,
    );
  }
}

export interface HarnessStaff {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: "reception" | "management";
}

export const HARNESS_STAFF_ID_PREFIX = "9e2e";

export async function upsertHarnessStaff(
  people: readonly HarnessStaff[],
): Promise<void> {
  for (const person of people) {
    if (!person.id.startsWith(HARNESS_STAFF_ID_PREFIX)) {
      throw new Error(
        `${person.id} is outside the ${HARNESS_STAFF_ID_PREFIX}… range this harness ` +
          `reserves. supabase/tests owns the 1111…/f444… fixture ids and a shared id ` +
          `makes the two suites fail depending on which ran first.`,
      );
    }
  }

  await withClient(async (client) => {
    for (const person of people) {
      await client.query(
        `insert into public.staff (id, email, full_name, role, is_active)
         values ($1::uuid, $2, $3, $4::public.staff_role, true)
         on conflict (id) do update
            set is_active = true,
                role = excluded.role,
                email = excluded.email,
                full_name = excluded.full_name`,
        [person.id, person.email, person.fullName, person.role],
      );
    }
  });
}

export async function removeHarnessStaff(): Promise<void> {
  await withClient(async (client) => {
    const pattern = `${HARNESS_STAFF_ID_PREFIX}%`;

    await client.query(
      `delete from public.staff_permissions sp
        where sp.staff_id in (select s.id from public.staff s where s.id::text like $1)`,
      [pattern],
    );

    await client.query(
      `update public.suite_occupancy o
          set created_by = null
        where o.created_by in (select s.id from public.staff s where s.id::text like $1)`,
      [pattern],
    );

    const { rows } = await client.query<{
      id: string;
      is_harness: boolean;
      is_management_quorum: boolean;
      is_pinned_by_documents: boolean;
    }>(
      `select s.id::text as id,
              (s.id::text like $1) as is_harness,
              (s.role = 'management' and s.is_active) as is_management_quorum,
              (exists (select 1 from public.payments p
                        where p.recorded_by = s.id and ${documentedBooking("p.booking_id")})
               or exists (select 1 from public.refunds r
                           where (r.requested_by = s.id or r.withdrawn_by = s.id)
                             and ${documentedBooking("r.booking_id")})
               or exists (select 1 from public.bookings b
                           where b.created_by = s.id and ${documentedBooking("b.id")})) as is_pinned_by_documents
         from public.staff s
        order by s.id`,
      [pattern],
    );

    const harness = rows.filter((row) => row.is_harness);
    if (harness.length === 0) return;

    const quorumOutsideTheHarness = rows.some(
      (row) => (!row.is_harness || row.is_pinned_by_documents) && row.is_management_quorum,
    );

    const keep = quorumOutsideTheHarness
      ? null
      : (harness.find((row) => row.is_management_quorum)?.id ?? null);

    const removable = harness
      .filter((row) => !row.is_pinned_by_documents)
      .map((row) => row.id)
      .filter((id) => id !== keep);

    if (removable.length === 0) return;

    await client.query("delete from public.staff s where s.id = any($1::uuid[])", [
      removable,
    ]);
  });
}

function documentedBooking(bookingColumn: string): string {
  return `(exists (select 1 from public.invoices i where i.booking_id = ${bookingColumn})
           or exists (select 1 from public.credit_notes cn where cn.booking_id = ${bookingColumn}))`;
}

export async function wipeUndocumentedBookings(): Promise<void> {
  await withClient(async (client) => {
    await client.query("update public.bookings set occupancy_id = null where occupancy_id is not null");
    await client.query("delete from public.suite_occupancy");
    await client.query(
      `delete from public.cleaning_tasks t
        where t.booking_id is not null and not ${documentedBooking("t.booking_id")}`,
    );
    await client.query(
      `delete from public.acceptance_records a where not ${documentedBooking("a.booking_id")}`,
    );
    await client.query(
      `delete from public.booking_guests g where not ${documentedBooking("g.booking_id")}`,
    );
    await client.query(
      `delete from public.refunds r
        where not ${documentedBooking("r.booking_id")}
          and not exists (select 1 from public.credit_notes cn where cn.refund_id = r.id)`,
    );
    await client.query(
      `delete from public.payment_events e
        where (e.booking_id is null or not ${documentedBooking("e.booking_id")})
          and not exists (select 1 from public.invoice_payments c where c.payment_id = e.payment_id)`,
    );
    await client.query(
      `delete from internal.checkout_attempts a
        where not ${documentedBooking("a.booking_id")}
          and not exists (select 1 from public.invoice_payments c where c.payment_id = a.payment_id)`,
    );
    await client.query(
      `delete from public.payments p
        where not ${documentedBooking("p.booking_id")}
          and not exists (select 1 from public.invoice_payments c where c.payment_id = p.id)`,
    );
    await client.query(`delete from public.bookings b where not ${documentedBooking("b.id")}`);
    await client.query(
      `delete from public.customers c
        where not exists (select 1 from public.bookings b where b.customer_id = c.id)
          and not exists (select 1 from public.invoices i where i.customer_id = c.id)
          and not exists (select 1 from public.credit_notes cn where cn.customer_id = c.id)`,
    );
  });
}
