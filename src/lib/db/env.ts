import { z } from "zod";

const publicEnvSchema = z.object({
  url: z.url("NEXT_PUBLIC_SUPABASE_URL must be the project URL"),
  key: z.string().min(1, "A Supabase publishable (anon) key is required"),
});

export type SupabasePublicEnv = z.infer<typeof publicEnvSchema>;

let cached: SupabasePublicEnv | null = null;

export function supabasePublicEnv(): SupabasePublicEnv {
  if (cached) return cached;

  const parsed = publicEnvSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error(
      "Supabase environment is not configured: " +
        parsed.error.issues.map((i) => `${String(i.path[0])} — ${i.message}`).join("; ") +
        ". See .env.example.",
    );
  }

  cached = parsed.data;
  return cached;
}
