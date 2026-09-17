import { createClient } from "@supabase/supabase-js";
import { supabasePublicEnv } from "@/lib/db/env";
import { fetchPublishedCmsContent } from "@/lib/db/queries/cms";
import type { Database } from "@/types/database.generated";

// Anonymous, stateless read: Proxy never needs a staff session or service key.
export async function fetchPublicUrlRules() {
  const { url, key } = supabasePublicEnv();
  const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return fetchPublishedCmsContent(client, "urls");
}
