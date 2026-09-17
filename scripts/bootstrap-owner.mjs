import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const candidates = [
  ["SUPABASE_SECRET_KEY", process.env.SUPABASE_SECRET_KEY],
  ["SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY],
].filter(([, value]) => Boolean(value));

const email = (process.argv[2] ?? "").trim().toLowerCase();
const fullName = (process.argv[3] ?? "").trim();

if (!email || !fullName) {
  console.error("Usage: npm run staff:bootstrap -- <email> \"<full name>\"");
  process.exit(1);
}

if (!url || candidates.length === 0) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set.",
  );
  process.exit(1);
}

async function usableAdminClient() {
  const failures = [];

  for (const [name, value] of candidates) {
    const client = createClient(url, value, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { count, error } = await client
      .from("staff")
      .select("id", { count: "exact", head: true })
      .eq("role", "management")
      .eq("is_active", true);

    if (!error) {
      if (failures.length > 0) {
        console.warn(
          `! ${failures.map(([n]) => n).join(", ")} did not authenticate — used ${name} instead.`,
        );
        console.warn("  Replace the stale key in .env; a wrong service key breaks the webhook and cron too.");
      }
      return { client, count: count ?? 0 };
    }

    const detail = error.message || error.details || error.hint || JSON.stringify(error);
    failures.push([name, detail]);
  }

  console.error("No service key could read the staff table:\n");
  for (const [name, detail] of failures) {
    console.error(`  ${name}: ${detail}`);
  }
  console.error(
    "\nAn 'Unregistered API key' means that key belongs to a different project or was revoked." +
      "\nCopy a fresh one from Supabase → Project Settings → API keys.",
  );
  process.exit(1);
}

const { client: admin, count } = await usableAdminClient();

if ((count ?? 0) > 0) {
  console.error(
    `There ${count === 1 ? "is" : "are"} already ${count} active Management account${count === 1 ? "" : "s"}.\n` +
      "Invite the next person from the console instead — this script exists only to create the first one.",
  );
  process.exit(1);
}

async function findAuthUser(address) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find((user) => user.email?.toLowerCase() === address);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await findAuthUser(email);

if (!user) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  if (error) {
    console.error("Could not create that account:", error.message);
    process.exit(1);
  }
  user = data.user;
  console.log(`→ created an auth account for ${email}`);
} else {
  console.log(`→ ${email} already has an auth account`);
}

const { error: insertError } = await admin
  .from("staff")
  .upsert(
    { id: user.id, email, full_name: fullName, role: "management", is_active: true },
    { onConflict: "id" },
  );

if (insertError) {
  console.error("Could not create the staff row:", insertError.message);
  process.exit(1);
}

console.log(`✓ ${fullName} <${email}> is now Management`);
console.log("");
console.log("  Next: open /sign-in and choose \"Forgot your password?\".");
console.log(`  We email ${email} a branded WellPlace message with a`);
console.log("  \"Choose a new password\" button. That is the same email your");
console.log("  staff receive when you invite them from the console.");
