import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.generated";

export type WellPlaceClient = SupabaseClient<Database>;

export type { Database };
