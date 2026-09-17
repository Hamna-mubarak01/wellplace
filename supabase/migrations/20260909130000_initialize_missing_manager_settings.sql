with added as (
  insert into public.settings (key, value, value_type, source_tag, description) values
  ('booking.personal_request_max_length', null, 'integer', '§6.1 · [OUR CHOICE]', 'Guest note length'),
  ('overrun.rate_source', null, 'string', '§7.6 · Q-21', 'Overstay charges'),
  ('overrun.fixed_fils_per_increment', null, 'integer', '§7.6 · Q-21', 'Custom overstay amount'),
  ('reception.board_default_view', null, 'string', '§9.1 · [OUR CHOICE]', 'Reception’s starting view'),
  ('reception.arrival_overdue_minutes', null, 'integer', '§9.3 · [OUR CHOICE]', 'Warn when a guest has not arrived'),
  ('reception.checkin_overdue_minutes', null, 'integer', '§9.3 · [OUR CHOICE]', 'Warn when check-in is taking too long'),
  ('reception.cleaning_confirm_minutes', null, 'integer', '§9.3 · [OUR CHOICE]', 'Remind Reception to record cleaning'),
  ('reception.default_extension_minutes', null, 'integer', '§7.6 · [OUR CHOICE]', 'Suggested extra time for a visit'),
  ('reception.hold_expiry_warning_minutes', null, 'integer', '§9.3 · [OUR CHOICE]', 'Warn before a payment reservation expires'),
  ('security.contact_rate_limit_per_hour', null, 'integer', '§13 · [OUR CHOICE]', 'Contact messages allowed'),
  ('security.contact_rate_limit_window_minutes', null, 'integer', '§13 · [OUR CHOICE]', 'Count contact messages over'),
  ('tax.inclusive', null, 'boolean', '[CLIENT] launch pricing specification', 'Prices already include VAT'),
  ('tax.label', null, 'string', '[CLIENT] launch pricing specification', 'Name of the tax'),
  ('pricing.currency', null, 'string', '§6.4', 'Price currency'),
  ('pricing.rounding_fils', null, 'integer', '[CLIENT] launch pricing specification', 'Round offer prices to the nearest'),
  ('pricing.offer_headline', null, 'string', '[CLIENT] launch pricing specification', 'Main offer message'),
  ('pricing.offer_subline', null, 'string', '[CLIENT] launch pricing specification', 'Extra offer message'),
  ('pricing.offer_label', null, 'string', '[CLIENT] launch pricing specification', 'Label beside an offer price'),
  ('contact.whatsapp_e164', null, 'string', '§4.3', 'WhatsApp number'),
  ('contact.email', null, 'string', '§4.3', 'Booking help email')
  on conflict (key) do nothing
  returning key, value
)
select internal.write_audit(
  'initialize_setting', 'public.settings', s.key, null,
  jsonb_build_object('value', s.value),
  'Add missing storage for Management settings. Existing application defaults continue to apply until the manager saves a value. [CLIENT 8 September 2026]'
)
from added s;
