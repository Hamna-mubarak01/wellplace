/**
 * Creates the two demo sign-ins the README documents.
 *
 * Auth accounts cannot be seeded from SQL reliably — the Auth service owns that
 * schema — so this runs against a started local stack and uses the admin API,
 * then writes the matching public.staff rows that carry the role.
 *
 *   npm run demo:seed
 *
 * It is safe to run repeatedly: existing accounts have their password reset to
 * the documented one rather than being duplicated.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) must be set.\n" +
      "Copy them out of `npx supabase start` into .env first.",
  );
  process.exit(1);
}

const ACCOUNTS = [
  {
    email: "manager@wellplace.example",
    password: "demo-manager-2026",
    fullName: "Demo Manager",
    role: "management",
  },
  {
    email: "reception@wellplace.example",
    password: "demo-reception-2026",
    fullName: "Demo Reception",
    role: "reception",
  },
];

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

for (const account of ACCOUNTS) {
  const existing = await findUser(account.email);

  let userId;
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: account.password,
      email_confirm: true,
    });
    if (error) {
      console.error(`Could not reset ${account.email}: ${error.message}`);
      process.exit(1);
    }
    userId = existing.id;
    console.log(`→ ${account.email} already existed — password reset`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
    });
    if (error) {
      console.error(`Could not create ${account.email}: ${error.message}`);
      process.exit(1);
    }
    userId = data.user.id;
    console.log(`→ created ${account.email}`);
  }

  const { error: staffError } = await admin.from("staff").upsert(
    {
      id: userId,
      email: account.email,
      full_name: account.fullName,
      role: account.role,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (staffError) {
    console.error(`Could not write the staff row for ${account.email}: ${staffError.message}`);
    process.exit(1);
  }
}

console.log("");
console.log("✓ demo sign-ins ready");
for (const account of ACCOUNTS) {
  console.log(`  ${account.role.padEnd(10)} ${account.email}  /  ${account.password}`);
}
console.log("");
console.log("  Sign in at http://localhost:3000/sign-in");
