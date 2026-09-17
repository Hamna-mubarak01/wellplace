# WellPlace

A complete suite booking and venue management system — public website, guest
checkout, a Reception desk console and a Management back office, all running on
one engine.

I built WellPlace for my family's wellness suites, because the booking tools we
tried were either a calendar with no money in it or a spa platform that cost
more per month than the suites earned in a quiet week. This repository is the
whole thing, running on fictional data so anyone can clone it and click through
every screen.

**It runs entirely on your machine.** No account, no API key, no paid service,
no hosted database. `npm install`, two commands, and the full system is up.

---

## What it does

Four surfaces share one booking engine, so a change on any of them is visible
on the others immediately. If Reception writes down a walk-in, the website stops
offering that slot before the guest finishes reading the page.

**Public website** — home, concept, suites, FAQ, contact and legal pages, all
editable from the CMS in the console rather than in code. Runs in either
`waitlist` mode before opening or `full` mode with booking live.

**Guest booking** — pick a date and arrival time, choose a suite, add guests and
add-ons, apply a coupon, pay, and get a receipt. Availability, cleaning buffers
between bookings, per-suite capacity, child and adult rate cards, VAT and
overrun charges are all enforced server-side.

**Reception console** — the desk view. A live board of today's suites, walk-in
and telephone bookings, taking payments, cleaning tasks, shift handover notes
and operational alerts.

**Management console** — pricing and rate cards, suite configuration,
availability rules, coupons, customers and blocked guests, the waitlist,
staff accounts and permissions, email message templates, the site
CMS, and finance: payments, refunds, invoices and credit notes.

### How it is built

- **Next.js 16** (App Router, React 19, Server Components and Server Actions)
- **Supabase** — Postgres, Auth, row-level security
- **TypeScript** end to end, **Tailwind CSS v4** and **shadcn/ui**
- **Every write goes through a Postgres function.** The application never
  issues a bare insert or update; business rules that must not be bypassed —
  allocation, pricing, payment state — live in the database next to the data.
- **No business number is hard-coded.** Thresholds, fees, buffers and limits
  are Management-configurable settings, not literals in the source.
- **Tested** with Vitest for the application and pgTAP for the database rules,
  plus Playwright for the booking flow end to end.

---

## Running it

You need **Node 20+** and **Docker** (for the local database).

```bash
git clone https://github.com/Hamna-mubarak01/wellplace.git
cd wellplace
npm install
```

**1. Start the local database.** This brings up Postgres, Auth and the REST API
in Docker. It prints a URL and a set of keys — keep them.

```bash
npx supabase start
```

**2. Configure the app.** Copy the example environment and paste in the keys
that `supabase start` printed:

```bash
cp .env.example .env
```

You only need `NEXT_PUBLIC_SUPABASE_URL`, the publishable/anon key and the
secret/service-role key. Everything else in the file already has a working
default.

**3. Load the demo data.** The first command applies all migrations and seeds
the suites, pricing and a spread of bookings around today. The second creates
the two staff sign-ins.

```bash
npx supabase db reset
npm run demo:seed
```

**4. Run it.**

```bash
npm run dev
```

- Website — <http://localhost:3000>
- Reception — <http://localhost:3000/reception>
- Management — <http://localhost:3000/manage>

### Demo sign-ins

| Role | Email | Password |
|---|---|---|
| Management | `manager@wellplace.example` | `demo-manager-2026` |
| Reception | `reception@wellplace.example` | `demo-reception-2026` |

### Stopping

```bash
npx supabase stop
```

---

## What is simulated

Everything works. Nothing leaves your machine.

| | |
|---|---|
| **Payments** | A built-in simulator walks the real checkout path — redirect, signed webhook, settlement, receipt, refund. `PAYMENT_MODE=simulation` is the default and no card processor ships with this project. |
| **Email** | Printed to the server console by default, so you can read every booking confirmation and invoice without a mail account. Set `MAIL_TRANSPORT=smtp` to send for real through any free SMTP account — a Gmail App Password works. |
| **Analytics** | Off unless you add your own container ID. |
| **Data** | The venue, address, contact details, guests, bookings and legal texts are fictional sample content. |

---

## Tests

```bash
npm run verify        # types, lint, boundaries, contrast, unit tests
npm test              # unit and integration tests
npm run db:test:up    # throwaway Postgres for the SQL tests
npm run db:pgtap      # database rules and row-level security
npm run test:e2e      # Playwright, against a running demo
```

---

## Layout

```
src/app/(site)       public website and guest booking
src/app/(console)    Reception and Management
src/lib/config/      every configurable business value
src/lib/db/          the only place Supabase is called
src/lib/payments/    payment providers (simulator)
src/lib/messaging/   email transports (log and SMTP)
supabase/migrations  schema, functions, row-level security
supabase/tests       pgTAP tests for the database rules
tests/               Vitest and Playwright suites
```

Two conventions are worth knowing before changing anything: `supabase.from()`
never leaves `src/lib/db/`, and business values never leave `src/lib/config/`.
`npm run lint:boundaries` enforces both.
