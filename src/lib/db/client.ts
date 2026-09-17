import { createBrowserClient } from "@supabase/ssr";

import { supabasePublicEnv } from "@/lib/db/env";
import type { WellPlaceClient } from "@/lib/db/types";

export function createClient(): WellPlaceClient {
  const { url, key } = supabasePublicEnv();
  return createBrowserClient(url, key);
}
