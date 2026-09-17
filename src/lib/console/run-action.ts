import { toast } from "@/lib/console/feedback";
import { ACTION_UNCONFIRMED } from "@/lib/domain/action-errors";

export type ActionOutcome = { ok: true } | { ok: false; message?: string };

export const NETWORK_MESSAGE =
  `The connection was interrupted. ${ACTION_UNCONFIRMED}`;

export async function runAction(
  action: () => Promise<ActionOutcome>,
  successMessage: string,
): Promise<boolean> {
  try {
    const result = await action();

    if (result.ok) {
      toast.success(successMessage);
      return true;
    }

    toast.error(result.message ?? "That did not go through.");
    return false;
  } catch (cause) {
    console.error("[console] action threw:", cause);
    toast.error(NETWORK_MESSAGE);
    return false;
  }
}
