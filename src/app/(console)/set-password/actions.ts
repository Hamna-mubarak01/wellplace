"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { claimInvitationIfAny, readStaffSession } from "@/lib/auth/session";
import { CONSOLE_HOME, homeForRole } from "@/lib/auth/console";
import { createClient } from "@/lib/db/server";
import { passwordSchema } from "@/lib/auth/password";

export type SetPasswordResult =
  | { status: "idle" }
  | { status: "invalid"; message: string }
  | { status: "expired" }
  | { status: "error" };

const formSchema = z
  .object({
    password: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    message: "Both passwords must match.",
    path: ["confirm"],
  });

export async function setPassword(
  _previous: SetPasswordResult,
  formData: FormData,
): Promise<SetPasswordResult> {
  const parsed = formSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return { status: "invalid", message: parsed.error.issues[0].message };
  }

  let destination: string = CONSOLE_HOME.reception;

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { status: "expired" };

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });

    if (error) {
      console.error("[console] password not set:", error.message);
      return { status: "invalid", message: error.message };
    }

    await claimInvitationIfAny(supabase);

    const staff = await readStaffSession();
    destination = staff ? homeForRole(staff.role) : CONSOLE_HOME.reception;
  } catch (cause) {
    console.error("[console] set-password fault:", cause);
    return { status: "error" };
  }

  redirect(destination);
}
