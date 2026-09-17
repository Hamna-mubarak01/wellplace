import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabasePublicEnv } from "@/lib/db/env";
import type { WellPlaceClient } from "@/lib/db/types";

function serviceKey(): string {
  const secret =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error(
      "SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set. See .env.example.",
    );
  }

  return secret;
}

export async function adminAuthRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (typeof window !== "undefined") {
    throw new Error(
      "A service-role request was made from the browser. It bypasses RLS and " +
        "must never leave the server — see doc 3 §5.6.",
    );
  }

  const { url } = supabasePublicEnv();
  const key = serviceKey();

  return fetch(`${url.replace(/\/+$/, "")}/auth/v1${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
}

export function createAdminClient(): WellPlaceClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "The service-role client was constructed in the browser. It bypasses RLS " +
        "and must never leave the server — see doc 3 §5.6.",
    );
  }

  const { url } = supabasePublicEnv();

  return createSupabaseClient(url, serviceKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
