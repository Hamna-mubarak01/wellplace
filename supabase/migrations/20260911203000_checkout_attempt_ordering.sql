alter table internal.checkout_attempts alter column created_at set default clock_timestamp();

comment on column internal.checkout_attempts.created_at is
  '[OUR CHOICE] When the attempt was prepared, from clock_timestamp() so that two attempts made within one transaction still order correctly. settle_payment_event decides whether a payment is for the booking''s current attempt, and release_cancelled_guest_hold decides whether a session has moved on to another booking, by comparing these values; now() is fixed for a whole transaction and would make two attempts look simultaneous.';
