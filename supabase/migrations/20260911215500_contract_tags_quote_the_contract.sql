comment on function public.record_refund(uuid, integer, text) is
  '[Contract: "full and partial refunds, reasons and pending processing"; OUR CHOICE] The older Management refund recorder, kept because pgTAP and direct Management use still reach it; the consoles now use request_payment_refund. It follows the same ceiling (refunds that were withdrawn do not count) and credits VAT from the payment''s frozen tax through internal.refund_tax_share. It still moves the payment to partially or fully refunded when the request is recorded, as it always has; refund_settlement_status recomputes the status from settled amounts when the return is confirmed.';

comment on function public.confirm_refund_return(uuid, text, text) is
  '[Contract: "Gateway transaction, booking, receipt/invoice and refund must be uniquely linked and reconcilable."; OUR CHOICE] Management''s confirmation that a refund''s money has left WellPlace. A withdrawn request is refused with WP071 and a plain message, instead of failing the refunds_withdrawn_is_stopped check with a generic one, which a stale Management page could otherwise trigger after Reception withdrew the request.';

comment on function public.prepare_guest_payment(uuid, uuid, jsonb, text, text, boolean) is
  '[Contract: "After a failed payment, the hold remains active until its original expiry and the guest may retry during that period."; CLIENT pricing specification; OUR CHOICE] A declined or cancelled payment retries against its original booking reference, and each attempt keeps its own immutable quote and provider result; the original hold expiry is never extended. A hold keeps the cleaning buffer it was taken with: the check that refused a hold whose buffer no longer matched cleaning.buffer_minutes is removed, because a changed default applies to new claims only, and it blocked a declined guest from retrying until their hold expired.';

comment on function internal.update_settled_refund_status() is
  '[Contract: "Payment states include at minimum open, pending, paid, failed, cancelled, partially refunded, fully refunded and manual review."; OUR CHOICE] Moves a payment to partially or fully refunded from settled amounts only; a pending or withdrawn request does not claim that money moved. When the full refund of a booking waiting for recovery settles, the booking is closed as cancelled, which also clears its payment_without_suite alert.';

comment on function internal.release_cancelled_guest_hold() is
  '[Contract: "online and Reception use the same availability"; OUR CHOICE] Releases the guest''s checkout hold when their booking is cancelled, so a later payment has nothing to convert. It releases only the hold that belongs to THIS booking — same visit time, and no newer checkout in the same session for another booking — because a guest''s session can outlive one booking and hold a time for the next.';

comment on function public.settle_payment_event(text, text, uuid, text, integer, text, boolean, jsonb) is
  '[Contract: "A booking may be confirmed as paid only after a server-side verified payment-provider event, never from the browser redirect alone"; Contract: "if no suite is available, raise an immediate operational alert, inform the guest, and initiate an automatic or controlled refund process"; OUR CHOICE] The only writer of an online payment result, reached only from the payment callback after it has verified the provider signature, and callable only by the service role.

A PAYMENT ONLY CONFIRMS THE BOOKING IT WAS TAKEN FOR. A declined payment retries against the same booking, and a retry may change the guests, the time or the price. A success for an earlier attempt — one with a newer attempt on the booking, or whose amount no longer equals the booking''s total — therefore never confirms it: the money goes to an automatic pending refund, and the booking and the guest''s current hold are left alone for the attempt still in progress.

IDEMPOTENCY. The payment_events insert is the signal: a delivery already seen is a no-op that reports the current state. A success that follows a decline on the same, still current attempt is processed as a success, because money has moved.

A SUCCESS NEVER REVIVES A CLOSED BOOKING. A terminal booking keeps its status. A payment that was voided before the money arrived is recorded as paid, because money has moved, and the full amount goes to a pending refund.

A HELD SUITE TAKEN OUT OF USE IS NOT CONFIRMED; the booking is allocated through allocate_suite instead. Only a hold for this booking''s own visit time is ever released.

NO SUITE, OR NO USABLE BOOKING: CONTROLLED REFUND. The payment is recorded as paid, the booking moves to awaiting_recovery with no suite, and a pending refund is created with no requested_by. The detectors raise payment_without_suite and refund_pending from that state until Management confirms the return; an automatic refund cannot be withdrawn.';

comment on function public.payment_message_context(uuid) is
  '[Contract: "Automatic templates for booking confirmation, payment, failed payment, rescheduling, cancellation, refund, reminder, directions/parking and review request."; OUR CHOICE] Everything a guest message about one payment may state, read from stored values only (INV-21) and never re-priced. It carries no suite number or capacity (INV-01). Staff and the payment callback may read it; the guest never calls it.';
