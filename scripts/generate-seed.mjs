import { writeFileSync } from "node:fs";
import { SETTINGS } from "../src/lib/config/registry.ts";
import { LAUNCH_PRICE_TIERS } from "../src/lib/config/pricing.ts";

const quote = (v) => String(v).replace(/'/g, "''");

const sql = (v) =>
  v === null || v === undefined ? "null" : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;

const typeOf = (v) => {
  if (v === null || v === undefined) return "unknown";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "decimal";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "object") return "object";
  return "string";
};

const DECLARED = {
  "booking.max_horizon_days": "integer",
  "booking.same_day_cutoff": "time", "hours.regular": "object", "hours.seasonal": "object",
  "hours.exceptions": "array", "hours.closures": "array", "rules.cancellation": "object",
  "rules.reschedule": "object", "rules.refund": "object", "rules.no_show": "object",
  "rules.late_arrival": "object", "tax.vat_percent": "decimal",
  "overrun.fixed_fils_per_increment": "integer",
  "contact.whatsapp_e164": "string", "contact.email": "string",
};


const OPEN_ALL_WEEK = Object.fromEntries(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [
    day,
    [{ opens: "10:00", closes: "22:00" }],
  ]),
);

const SEED_OVERRIDES = {
  "hours.regular": {
    value: OPEN_ALL_WEEK,
    source: "§10.2 · PLACEHOLDER",
    description:
      "Regular opening hours per weekday, Dubai wall clock",
    comment: [
      "-- PLACEHOLDER, not a client decision [§2].",
      "--",
      "-- The client has not supplied opening hours. §2 permits continuing with a",
      "-- placeholder rather than postponing the screen that reads it, and this is",
      "-- that placeholder: it exists so the booking grid has times to draw on a",
      "-- developer's machine and on staging.",
      "--",
      "-- It lives in the SEED and not in the registry default on purpose. Seed data",
      "-- is demo data; a registry default is what production falls back to, and a",
      "-- plausible 10:00-22:00 sitting there would be read as confirmed within a",
      "-- week. In production this row stays NULL until WellPlace supplies real",
      "-- hours, and the booking screen shows its §4.1 empty state until they do.",
    ].join("\n"),
  },
};

const int = (v) => (v === null || v === undefined ? "null" : String(v));

const intArray = (v) =>
  v === null || v === undefined ? "null" : `array[${v.join(",")}]::integer[]`;

const dateOrNull = (v) => (v === null || v === undefined ? "null" : `date '${quote(v)}'`);

const textOrNull = (v) => (v === null || v === undefined ? "null" : `'${quote(v)}'`);

const PRICE_TIER_NOTE = [
  "-- CONFIRMED CLIENT CONFIGURATION, not a placeholder [CLIENT §2].",
  "--",
  "-- the booking pricing specification §2 fixes",
  "-- these four rates: adult AED 220/hour regular against AED 165 for hours 1-2",
  "-- and AED 140 from hour 3, child AED 170/hour regular against AED 127.50 and",
  "-- AED 110. They are the launch price list, they are the client's own numbers,",
  "-- and unlike hours.regular below nothing here is invented.",
  "--",
  "-- They are NOT restated in this file. scripts/generate-seed.mjs imports",
  "-- LAUNCH_PRICE_TIERS from src/lib/config/pricing.ts and prints it, so the",
  "-- seeded rows and the constant the pricing engine is tested against cannot",
  "-- drift apart -- there is only one copy of the numbers. Change the constant,",
  "-- regenerate, and supabase/tests/pricing-schema.sql re-checks the result.",
  "--",
  "-- ON CONFLICT DO NOTHING, matching the suites seed: a reset builds them, and a",
  "-- staging database where Management has retuned a rate is left alone. §7",
  "-- requires those rates to be editable without a code change, and a seed that",
  "-- overwrote them on every run would quietly make that untrue.",
].join("\n");

const priceTierRows = LAUNCH_PRICE_TIERS.map(
  (t) =>
    `  ('${quote(t.id)}', '${quote(t.guestKind)}', ${int(t.fromHour)}, ${int(t.toHour)}, ` +
    `${int(t.regularFilsPerHour)}, ${int(t.offerFilsPerHour)}, ${int(t.offerPercent)}, ` +
    `${intArray(t.weekdays)}, ${dateOrNull(t.seasonFrom)}, ${dateOrNull(t.seasonTo)}, ` +
    `${int(t.startWindow ? t.startWindow.fromMinutes : null)}, ` +
    `${int(t.startWindow ? t.startWindow.toMinutes : null)}, ${int(t.priority)})`,
).join(",\n");

const PLACEHOLDER_ADDON_NOTE = [
  "-- PLACEHOLDER, not a client decision [§8, §2].",
  "--",
  "-- §8 states that the commercial add-on catalogue and its final prices will be",
  "-- supplied separately, and sanctions building the booking flow and the",
  "-- Management controls now against configurable placeholder entries. These two",
  "-- are those entries. The names come from §8's own worked example; the",
  "-- comparison prices, the quantity ceiling and the notes are ours and are made",
  "-- up.",
  "--",
  "-- They live in the SEED and not in a registry default, for the same reason",
  "-- hours.regular does. Seed data is demo data; a default is what production",
  "-- falls back to, and a plausible AED 25 towel sitting there would be read as",
  "-- confirmed within a week. In production public.addons stays empty until",
  "-- WellPlace supplies a catalogue, and the add-on step shows its §4.1 empty",
  "-- state until they do.",
  "--",
  "-- offer_price_fils IS ZERO ON PURPOSE. §8 makes AED 0 the automatic-inclusion",
  "-- trigger with no separate auto-add switch, so a zero-priced seeded row is the",
  "-- only way that rule is demonstrable on a developer's machine: both items",
  "-- enter the cart at their default quantity of 1, keep their comparison price",
  "-- struck through, and carry no saving label, which is why saving_label is null",
  "-- rather than empty.",
  "--",
  "-- max_quantity is 3 and is deliberately not 2 or 5. §8 says twice that a",
  "-- quantity is never linked to the guest count, so a ceiling that happened to",
  "-- equal booking.guests_min or booking.guests_max would invite exactly the",
  "-- derivation the specification forbids.",
].join("\n");

const PLACEHOLDER_ADDONS = [
  {
    id: "a5100000-0000-4000-8000-000000000001",
    name: "Towel rental",
    description: "A fresh set of spa towels, laid out in your suite before you arrive.",
    kind: "rental",
    regularPriceFils: 2500,
    offerPriceFils: 0,
    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 3,
    sortOrder: 10,
    receptionNote: "Set out before arrival. Collect with the linen at cleaning.",
  },
  {
    id: "a5100000-0000-4000-8000-000000000002",
    name: "Bathrobe rental",
    description: "A warm cotton bathrobe for the length of your visit.",
    kind: "rental",
    regularPriceFils: 5000,
    offerPriceFils: 0,
    defaultQuantity: 1,
    minQuantity: 1,
    maxQuantity: 3,
    sortOrder: 20,
    receptionNote: "Set out before arrival. Collect with the linen at cleaning.",
  },
];

const placeholderAddonRows = PLACEHOLDER_ADDONS.map(
  (a) =>
    `  ('${quote(a.id)}', '${quote(a.name)}', '${quote(a.description)}', ` +
    `'${quote(a.kind)}', ${int(a.regularPriceFils)}, ${int(a.offerPriceFils)}, ` +
    `${int(a.defaultQuantity)}, ${int(a.minQuantity)}, ${int(a.maxQuantity)}, ` +
    `${int(a.sortOrder)}, ${textOrNull(a.receptionNote)})`,
).join(",\n");

const rows = Object.entries(SETTINGS).map(([key, d]) => {
  const override = SEED_OVERRIDES[key];
  if (override) {
    return `${override.comment}\n  ('${quote(key)}', ${sql(override.value)}, '${DECLARED[key] ?? typeOf(override.value)}', '${quote(override.source)}', '${quote(override.description)}')`;
  }

  const type = DECLARED[key] ?? typeOf(d.defaultValue);
  return `  ('${quote(key)}', ${sql(d.defaultValue)}, '${type}', '${quote(d.source)}', '${quote(d.description)}')`;
});

writeFileSync(
  new URL("../supabase/seed/reference-data.sql", import.meta.url),
  `-- GENERATED FILE — do not edit by hand.
insert into public.suites (suite_number, priority, status)
select n, n * 10, 'available'::public.suite_status
from generate_series(1, 7) as n
on conflict (suite_number) do nothing;
insert into public.settings (key, value, value_type, source_tag, description) values
${rows.join(",\n")}
on conflict (key) do update
  set value_type = excluded.value_type,
      source_tag = excluded.source_tag;
${PRICE_TIER_NOTE}
insert into public.price_rules
  (code, guest_kind, from_hour, to_hour, regular_fils_per_hour,
   offer_fils_per_hour, offer_percent, weekdays, season_from, season_to,
   start_from_minutes, start_to_minutes, priority) values
${priceTierRows}
on conflict (code) do nothing;
${PLACEHOLDER_ADDON_NOTE}
insert into public.addons
  (id, name, description, kind, regular_price_fils, offer_price_fils,
   default_quantity, min_quantity, max_quantity, sort_order, reception_note) values
${placeholderAddonRows}
on conflict (id) do nothing;
`,
);
console.log(
  `✓ generated ${rows.length} settings + 7 suites + ${LAUNCH_PRICE_TIERS.length} price tiers + ${PLACEHOLDER_ADDONS.length} placeholder add-ons`,
);
