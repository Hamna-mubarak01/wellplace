alter table public.messages
  drop constraint messages_template_key_known,
  add constraint messages_template_key_known check (template_key = any (array[
    'booking_confirmation', 'payment_received', 'payment_failed', 'booking_rescheduled',
    'booking_cancelled', 'refund_issued', 'booking_reminder', 'directions_and_parking',
    'review_request', 'secure_link', 'payment_link', 'invoice_issued'
  ]::text[]));

alter table public.message_templates
  drop constraint message_templates_key_known,
  add constraint message_templates_key_known check (key = any (array[
    'booking_confirmation', 'payment_received', 'payment_failed', 'booking_rescheduled',
    'booking_cancelled', 'refund_issued', 'booking_reminder', 'directions_and_parking',
    'review_request', 'secure_link', 'payment_link', 'invoice_issued'
  ]::text[]));

comment on constraint messages_template_key_known on public.messages is
  '[§12, §11.5; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The closed list of guest message kinds the message log accepts. invoice_issued was added so a tax invoice sent to a guest is queued and logged through public.queue_message and public.record_message_attempt like every other guest message. It is transactional: messages_marketing_matches_template keeps is_marketing true for review_request alone, so switching marketing off never stops an invoice email [INV-17].';

comment on constraint message_templates_key_known on public.message_templates is
  '[§12; CLIENT console redesign brief 2026-09-11; Project owner''s direction 2026-09-11] The closed list of message template keys, kept identical to messages_template_key_known. invoice_issued may carry a Management template like the other eleven; public.queue_message still accepts it while no template row exists, as it does for every key. It is transactional under message_templates_marketing_matches_kind.';
