# WellPlace

A complete suite booking and venue management system.It's a public website, guest
checkout, a Reception desk console and a Management back office, all running on
one engine.

I built WellPlace for my family's wellness suites, because the booking tools we
tried were either a calendar with no money in it or a spa platform that cost
more per month than the suites earned in a quiet week. This repository is the
whole thing, running on fictional data so anyone can clone it and click through
every screen.

---

## Core parts


**Public website** — home, concept, suites, FAQ, contact and legal pages, all
editable from the CMS in the console rather than in code. Runs in either
`waitlist` mode (which was actually a coming soon like page we published before the actually website) or `full` mode 

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

### Demo sign-ins

| Role | Email | Password |
|---|---|---|
| Management | `manager@wellplace.example` | `demo-manager-2026` |
| Reception | `reception@wellplace.example` | `demo-reception-2026` |


## Running it

You need **Node 20+** and **Docker** (for the local database)

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
