// Provision the admin account (PRD §7.2/§14): create a Supabase Auth user, then
// add it to the admin_users allowlist (linked by auth uid — is_admin() matches
// admin_users.user_id = auth.uid()). Idempotent: if the auth user already exists,
// its id is reused. Admin auth is fully Supabase-managed (bcrypt/JWT/cookies).
//
// Run: ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run provision:admin
import { serviceClient, requireEnv } from "./_env";
import type { SupabaseClient } from "@supabase/supabase-js";

async function findUserByEmail(
  supabase: SupabaseClient,
  target: string,
): Promise<string | null> {
  const wanted = target.toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error(`listUsers failed: ${error.message}`);
      process.exit(1);
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

async function main(): Promise<void> {
  const email = requireEnv("ADMIN_EMAIL");
  const password = requireEnv("ADMIN_PASSWORD");
  const supabase = serviceClient();

  let userId: string;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // Most likely "email already registered" — reuse the existing user.
    const existing = await findUserByEmail(supabase, email);
    if (!existing) {
      console.error(`createUser failed: ${error.message}`);
      process.exit(1);
    }
    userId = existing;
    console.log(`Admin auth user already existed: ${userId}`);
  } else {
    userId = data.user.id;
    console.log(`Created admin auth user: ${userId}`);
  }

  const { error: upErr } = await supabase
    .from("admin_users")
    .upsert({ user_id: userId, email }, { onConflict: "user_id" });
  if (upErr) {
    console.error(`admin_users upsert failed: ${upErr.message}`);
    process.exit(1);
  }

  console.log(`admin_users row ensured for ${email} (${userId}).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
