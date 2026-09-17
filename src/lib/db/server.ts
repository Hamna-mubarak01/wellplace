import { cookies } from "next/headers";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";

import { supabasePublicEnv } from "@/lib/db/env";
import type { WellPlaceClient } from "@/lib/db/types";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function writeCookies(
  store: CookieStore,
  cookiesToSet: ReadonlyArray<{
    name: string;
    value: string;
    options?: Parameters<CookieStore["set"]>[2];
  }>,
): boolean {
  try {
    for (const { name, value, options } of cookiesToSet) {
      store.set(name, value, options);
    }
    return true;
  } catch {
    return false;
  }
}

export const createClient = cache(async (): Promise<WellPlaceClient> => {
  const { url, key } = supabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        writeCookies(cookieStore, cookiesToSet);
      },
    },
  });
});
