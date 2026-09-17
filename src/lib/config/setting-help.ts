import type { SettingKey } from "@/lib/config/registry";

export const SETTING_HELP: Readonly<Record<SettingKey, string>> = {
  "booking.start_interval_minutes":
    "Choose how far apart start times appear. With 30 minutes, guests can choose 10:00, 10:30, 11:00 and so on. They can book the next free time.",
  "booking.durations_hours":
    "Choose the visit lengths guests can book. Add each length in hours, in the order you want it to appear.",
  "booking.guests_min":
    "The smallest group allowed for one booking. Adults and children both count.",
  "booking.guests_max":
    "The largest group allowed for one booking, including children.",
  "booking.child_min_age":
    "Children below this age cannot be included in a booking.",
  "booking.child_max_age":
    "Guests up to this age count as children. Older guests count as adults.",
  "booking.booker_min_age":
    "The person making the booking must be at least this age.",
  "booking.max_horizon_days":
    "Set how far ahead guests can book. For example, 21 days lets guests book up to three weeks ahead. Later dates stay unavailable.",
  "booking.personal_request_max_length":
    "Limit how much guests can write in their special request. Letters, spaces and punctuation all count.",
  "booking.same_day_cutoff":
    "After this Dubai time, guests can only book for a later day. Leave this off to accept today’s bookings while times are still available.",
  "cleaning.buffer_minutes":
    "Keep a suite unavailable for cleaning after each visit. It becomes available automatically when this time ends. Reception can hold it longer with a reason. Existing bookings keep their saved cleaning time.",
  "hold.minutes":
    "Reserve a guest’s chosen time while they pay. If they do not finish in time, the reservation expires and the time becomes available again.",
  "overrun.increment_minutes":
    "Set how many extra minutes count as one charge. With 5-minute blocks, staying 11 minutes longer is charged as three blocks. Choose the price in Overstay charges.",
  "overrun.rate_source":
    "Choose how to charge guests who stay longer. Charges apply per guest for each block of extra time that has started.",
  "overrun.fixed_fils_per_increment":
    "The amount charged to each guest for each extra-time block. Set this in Overstay charges.",
  "allocation.strategy":
    "Choose fixed priority, balanced rotation by bookings on the visit date, or the least recently allocated suite. Unavailable suites are always excluded.",
  "urgency.few_enabled": "Show this notice only when the remaining availability reaches its threshold.",
  "urgency.last_enabled": "Show this notice when availability is lowest. When off, the few-slots notice can still appear if enabled.",
  "urgency.none_enabled": "Show a label on times with no availability. Turning the label off does not allow bookings for a full time.",
  "urgency.mode": "Live notices use actual availability. A general message appears on available times without claiming limited availability.",
  "urgency.text_general": "An always-visible message for available times. Use a welcome or booking instruction, without a claim about how many places remain.",
  "urgency.enabled":
    "Show a short message beside available booking times. Fully booked times still show their message when this is off.",
  "urgency.threshold_few":
    "Show the “few left” message when this many suites or fewer are available, until the “almost full” message takes over.",
  "urgency.threshold_last":
    "Show the stronger “almost full” message when this many suites or fewer are available. Use a number no higher than the “few left” number.",
  "urgency.text_few":
    "Write the message guests see when only a few suites are available. The “few left” setting decides when it appears.",
  "urgency.text_last":
    "Write the message guests see when a time is nearly full. The “almost full” setting decides when it appears.",
  "urgency.text_none":
    "The words guests see when no suites are available. This time cannot be selected.",
  "urgency.text_filling":
    "Shown when bookings or payment reservations have reduced availability, before the “few left” message applies. Closing a suite alone does not trigger it.",
  "reception.board_default_view":
    "Choose the view Reception sees when opening the suite board. Staff can switch views at any time.",
  "reception.arrival_overdue_minutes":
    "Wait this many minutes after the booked start time before warning Reception about a missing arrival.",
  "reception.checkin_overdue_minutes":
    "Wait this many minutes after a guest arrives before warning Reception that they have not been checked in.",
  "reception.cleaning_confirm_minutes":
    "Wait this many minutes after checkout before reminding Reception to record completed cleaning. This reminder does not hold the suite unavailable.",
  "reception.default_extension_minutes":
    "Start the extend-visit form with this many extra minutes. Reception can change it for each guest.",
  "reception.hold_expiry_warning_minutes":
    "Warn Reception when this many minutes are left for a guest to complete payment.",
  "fees.tabby.enabled":
    "Turn on the extra service fee for guests paying with Tabby. Turn it off to charge no Tabby fee.",
  "fees.tabby.percent":
    "Calculate the fee from the order total before adding the fee. For example, 6% of AED 100 adds AED 6.",
  "fees.tabby.label":
    "The name guests see next to the extra fee in their price breakdown.",
  "hours.regular":
    "Set the opening and closing times for each day of the week. Turn a day off when the venue is closed. All times are Dubai time.",
  "hours.seasonal":
    "Use a different weekly schedule for a date range, such as Ramadan or a holiday season. Your usual hours return when it ends.",
  "hours.exceptions":
    "Change opening hours for a single date, such as opening later or closing earlier. These replace the usual or temporary hours for that day.",
  "hours.closures":
    "Close bookings for a whole day or several days. These closures apply even if other schedules say the venue is open.",
  "rules.cancellation":
    "Cancellation policy settings are not connected to booking decisions yet.",
  "rules.reschedule":
    "Rescheduling policy settings are not connected to booking decisions yet.",
  "rules.refund":
    "Refund policy settings are not connected to refund decisions yet.",
  "rules.no_show":
    "No-show policy settings are not connected to booking decisions yet.",
  "rules.late_arrival":
    "Late-arrival policy settings are not connected to booking decisions yet.",
  "security.waitlist_rate_limit_enabled":
    "Turn on to limit repeated waitlist submissions from the same email address or internet connection. Turn off to stop counting submissions. Your count and minutes are kept for when you turn it back on.",
  "security.contact_rate_limit_enabled":
    "Turn on to limit repeated contact messages from the same email address or internet connection. Turn off to stop counting messages. Your count and minutes are kept for when you turn it back on.",
  "security.availability_rate_limit_enabled":
    "Turn on to limit repeated searches for booking times from the same internet connection. Turn off to stop counting searches. Your count and minutes are kept for when you turn it back on.",
  "security.waitlist_rate_limit_per_hour":
    "Limit how often one internet connection can submit the waitlist form during the time period below. This helps prevent spam.",
  "security.waitlist_rate_limit_window_minutes":
    "The length of time used to count waitlist submissions. This works together with the submission limit above.",
  "security.contact_rate_limit_per_hour":
    "Limit how many contact messages one internet connection can send during the time period below.",
  "security.contact_rate_limit_window_minutes":
    "The length of time used to count contact messages. This works together with the message limit above.",
  "security.availability_rate_limit_per_hour":
    "Limit how many availability searches one internet connection can make during the time period below. Keep enough room for guests to compare dates and visit lengths.",
  "security.availability_rate_limit_window_minutes":
    "The length of time used to count availability searches. This works together with the search limit above.",
  "privacy.retention_months":
    "This setting is not connected to an automatic deletion schedule yet.",
  "privacy.delete_on_withdrawal":
    "This switch is not connected to the consent withdrawal process yet.",
  "tax.vat_percent":
    "The VAT percentage used when calculating booking prices.",
  "tax.inclusive":
    "Turn on if the listed prices include VAT. Turn off if VAT should be added to the listed prices.",
  "tax.label":
    "The name guests see next to the tax amount in their price breakdown.",
  "pricing.currency":
    "The three-letter currency code shown with prices, such as AED. Changing this does not convert existing price amounts.",
  "pricing.rounding_fils":
    "Choose the rounding step for offers calculated from a percentage discount. For example, AED 0.50 rounds to the nearest half dirham.",
  "pricing.offer_headline":
    "The main offer text shown with the booking price. Keep it consistent with the prices you offer. Leave the text empty to hide it.",
  "pricing.offer_subline":
    "A second line shown with the offer, such as a saving for longer visits. Leave it empty to hide it.",
  "pricing.offer_label":
    "A short name shown beside an offer price, such as “Special offer”.",
  "contact.whatsapp_e164":
    "The number opened by the website’s WhatsApp button. Include the country code, for example +971 followed by the number.",
  "contact.address": "The public venue address used on the Homepage and Contact page. Put each address line on a new line. Keep the homepage map pin aligned if the venue moves.",
  "contact.email":
    "The email address guests can use for booking help from the website.",
  "invoice.issuer_legal_name":
    "The business name printed as the issuer on every tax invoice, exactly as it appears on the trade licence. Invoices cannot be issued until this is entered.",
  "invoice.issuer_trn":
    "The 15-digit tax registration number printed on every tax invoice. Invoices cannot be issued until this is entered.",
  "invoice.issuer_address":
    "The business address printed as the issuer on every tax invoice. Invoices cannot be issued until this is entered.",
  "invoice.number_prefix":
    "Letters or numbers placed before each invoice number, followed by the year and a running number, for example INV-2026-000001. Changing it affects new invoices only.",
};

export function settingHelp(key: string): string | null {
  return key in SETTING_HELP ? SETTING_HELP[key as SettingKey] : null;
}
