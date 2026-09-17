export const ACTION_UNCONFIRMED =
  "We could not confirm whether the change was saved. Check the latest booking or record before trying again. If the problem continues, ask Management for help.";

export const NO_SUITE_MESSAGE =
  "No suite is available for the whole visit and the cleaning time afterwards. Existing bookings, temporary reservations or suite closures can prevent a longer visit from fitting.\n\nChoose a shorter visit, another start time or another day.";

export const SUITE_CONFLICT_MESSAGE =
  "The selected suite is unavailable for the whole visit and the cleaning time afterwards. Another reservation or closure overlaps this time.\n\nChoose another suite, a shorter visit or a different start time.";

export const NO_START_TIMES_MESSAGE =
  "No start time fits this visit on the selected date under the current opening hours and booking rules. Choose a shorter visit or another date.";

export const CUSTOMER_MISMATCH_MESSAGE =
  "These details differ from the saved customer. Select their profile again, or ask an authorised colleague to correct it.";

export const EXISTING_CUSTOMER_EMAIL_MESSAGE =
  "This email already belongs to a saved customer with different details. Choose them from the Customer list, or use a different email for a new customer.";

const MESSAGES: Readonly<Record<string, string>> = {
  WP082: "There is nothing to put back for this message — it is already using the built-in wording.",
  WP083: "There are no unpublished changes to publish. Save a draft first.",
  WP084: "Write the message before saving it.",
  WP085: "This invoice has credit notes for its refunds, so it cannot be voided on its own. Regenerate the invoice instead.",
  WP086: "An earlier invoice for this booking was issued for more than the payments linked to it, and this payment does not fit. Regenerate that earlier invoice, then issue the invoice again.",
  WP087: "A customer with this email already exists. Search for them in Customers or Leads instead of adding them again.",
  WP088: "This customer has bookings or messages on record, so they cannot be deleted. Block them instead.",

  WP068:
    "The available cleaning time has changed. Cleaning must finish before the next reservation starts or WellPlace closes. Refresh the limit, or move the next booking before extending again.",
  WP069:
    "This visit can no longer hold the suite within its opening hours. Refresh the schedule and check the current booking and suite status.",
  WP070:
    "The new cleaning end time has already passed. Choose enough minutes for cleaning to finish later than now.",
  WP071:
    "This refund request was withdrawn, so there is nothing to confirm. Refresh the page to see the current refunds.",
  WP072:
    "This suite still has a current or upcoming booking or payment reservation. Move those bookings to another suite or reschedule them, then retire the suite.",
  WP073:
    "This suite has booking history, so it cannot be deleted. Retire it instead: it stops taking bookings and its history is kept.",
  WP074:
    "This suite is retired. Return it to service before changing its status or scheduling it.",
  WP075:
    "This suite is already in service. Refresh the page to see its current status.",
  WP076:
    "The invoice details in Settings are incomplete. Enter the legal name, the 15-digit tax registration number and the address, and use only letters and numbers in the invoice number prefix, then issue the invoice again.",
  WP077:
    "This booking is complimentary, so there is nothing to invoice.",
  WP078:
    "There is no payment on this booking that still needs an invoice. Issue the invoice once a payment has been received.",
  WP079:
    "This invoice has already been voided and cannot be changed. Issue a new invoice for the booking if one is needed.",
  WP080:
    "These coupon codes cannot be generated as entered. Each code can appear only once, and the list and batch name must stay within the limits shown on the form. Correct them and generate again.",
  WP081:
    "Some of these coupon codes already exist. Change or remove them and generate again.",
  WP001: "You cannot delete the account you are using. Ask another authorised manager to make this change.",
  WP002: "This is the last active Management account. Activate another Management account before removing it.",
  WP003: "This invitation has already been accepted. Check the staff list for the account.",
  WP004: "This invitation was cancelled. Send a new invitation if access is still needed.",
  WP005: "This visit length is no longer available. Choose one of the session lengths currently offered.",
  WP006: "The cleaning time is missing or is outside the allowed range. Check the cleaning time, or ask Management to review the cleaning settings.",
  WP007: "The temporary reservation length is outside the allowed range. Ask Management to review the reservation settings.",
  WP008: "Your staff account is no longer active. Sign in again, or ask Management to check your access.",
  WP009: "There are too many times to check in one request. Choose a single date and try again.",
  WP010: NO_SUITE_MESSAGE,
  WP011: "The guest details do not meet the booking rules. Check the number of guests, their ages and the booking holder’s details before trying again.",
  WP012: "This customer is blocked from booking. Ask an authorised colleague to review the customer record before continuing.",
  WP013: "Your account cannot change the allocated suite. Ask a colleague with suite override permission to make this change.",
  WP014: "This action is not available in the booking or task’s current status. Close this panel and refresh the record to see the actions available now.",
  WP015: "The extra visit or cleaning time overlaps another reservation or closure in this suite. Choose less extra time, or arrange a different available time. The original booking has been kept.",
  WP016: `${NO_SUITE_MESSAGE} The original booking has been kept.`,
  WP018: "Your account cannot add, edit, delete or block customers. Ask a colleague with customer correction permission to help.",
  WP019: "This cleaning task is no longer at the stage needed for this action. Refresh the task and check its current status.",
  WP020: "This task has already been completed or cancelled. Refresh the task list to see its latest status.",
  WP021: "This message template is unavailable or switched off. Ask Management to check the template before sending the message.",
  WP022: "This message has been cancelled and cannot be sent. Review the message history before creating another message.",
  WP023: "This alert has already been resolved. Refresh the alert list to see what still needs attention.",
  WP024: "This shift has already been handed over. Refresh the shift details to see the latest handover.",
  WP025: "Online payments are confirmed by the payment provider. They cannot be marked as paid at the desk. Check the provider’s payment status before continuing.",
  WP026: "The amount is outside the allowed range. Check the amount and the booking’s current payment details before trying again.",
  WP027: "A complimentary booking cannot include a payment amount. Remove the amount, or choose the method used to receive the payment.",
  WP028: "This payment cannot be voided in its current status. If money has already been received, use the refund process instead.",
  WP029: "This refund would exceed the amount still available to refund. Check previous refunds and enter a smaller amount.",
  WP030: "This payment is not eligible for a refund in its current status. Refresh the payment details before continuing.",
  WP031: "Your account cannot change a booking’s price. Ask a colleague with price adjustment permission to help.",
  WP032: "The payment fee is outside the allowed range. Review the fee settings before saving again.",
  WP033: "This booking cannot accept this payment in its current status. Refresh the booking and check its payment details.",
  WP034: "This booking already has money recorded against it. Refund that money before making the booking complimentary.",
  WP035: "Your account can reserve more cleaning time but cannot shorten it. Keep the current cleaning time or longer, or ask a colleague with suite override permission to shorten it.",
  WP036: "Your account cannot perform this action. Sign in with the appropriate staff account or ask Management for help.",
  WP037: "An add-on quantity is outside its allowed range. Check the quantities shown for each add-on and try again.",
  WP038: "A selected add-on is sold out, no longer on sale, or unavailable for this visit. Review your extras and choose an available item before booking.",
  WP039: "This voucher is not valid for this booking date. Check the code and its validity dates, or remove it to continue.",
  WP040: "This voucher has reached its total usage limit. Use another voucher or remove it to continue.",
  WP041: "This customer has already used this voucher the maximum number of times. Use another voucher or remove it to continue.",
  WP042: "This voucher does not apply to any of the selected add-ons. Choose an eligible add-on or remove the voucher.",
  WP043: "The price tier’s end hour must not come before its start hour. Correct the hour range and save again.",
  WP044: "The add-on quantities are inconsistent. The default quantity must fall between the minimum and maximum quantities.",
  WP045: "The comparison price is lower than the offer price. Correct the prices so the advertised saving is accurate.",
  WP046: "The voucher’s discount details are incomplete or invalid. Check the discount type and amount before saving again.",
  WP047: "The voucher’s usage limits or selected add-ons are invalid. Check those details before saving again.",
  WP048: "One of these settings is no longer available. Reopen this panel to load the current settings.",
  WP049: "A setting contains the wrong kind of value. Reopen the settings panel and check the entries before saving.",
  WP050: "The suite priority must be a whole number of zero or more. Correct the priority and save again.",
  WP051: "This staff member already has that permission. Refresh their profile to see the current permissions.",
  WP052: "This staff member no longer has that permission. Refresh their profile to see the current permissions.",
  WP053: "This staff account is inactive. Activate the account before changing its permissions.",
  WP054: "The requested visit length does not match the booking details. Reopen the booking and choose the session length again.",
  WP055: "The extra-time charge cannot be calculated because its rate settings are missing or invalid. Ask Management to review the extra-time rates before recording the charge.",
  WP056: "This booking has no guests recorded, so a charge per guest cannot be calculated. Correct the guest details before recording extra time.",
  WP057: "This action needs a Reception account. Ask Reception to make the change.",
  WP058: "The suite details are incomplete or have changed. Refresh the suite list and check the suite number, name and priority.",
  WP059: "Another suite already uses this number. Enter a different suite number and save again.",
  WP060: "These details changed while the panel was open. Close and reopen it to load the latest values before trying again.",
  WP061: "This start time is no longer available. Choose another available time before continuing.",
  WP062: CUSTOMER_MISMATCH_MESSAGE,
  WP063: "The guest must accept the current terms before the booking can be created.",
  "23P01": "This time overlaps an existing reservation or suite closure. Choose another time or suite so the full visit and cleaning time can fit.",
  "23505": "A record with these details already exists. Refresh the list and check the existing record before adding another.",
  "23503": "A related record has changed or is still in use. Refresh the page and review it before trying again.",
  "23514": "These details do not meet the current rules. Check the values in the form before trying again.",
  "42501": "Your session or account does not allow this action. Sign in again, or ask Management to check your access.",
  "22023": "Some details are missing or invalid. Check the form and try again.",
  "22004": "A required detail is missing. Complete the form before trying again.",
  P0002: "This record could not be found. Refresh the list; it may have been removed or changed by another staff member.",
  "40001": "Another staff member changed this record at the same time. Refresh it and review the latest details before trying again.",
  "40P01": "Another change was being saved at the same time. Refresh the record and try again.",
};

export function databaseErrorMessage(error: { code?: string; message?: string }): string {
  const message = error.message ?? "";
  if (error.code === "WP011") {
    const count = message.match(/(\d+) guests is (above|below) booking\.guests_(?:max|min) of (\d+)/);
    if (count) return count[2] === "above"
      ? `This booking has ${count[1]} guests, but the maximum is ${count[3]}. Reduce the guest count or arrange separate bookings for the group.`
      : `This booking has ${count[1]} guests, but at least ${count[3]} are required. Check the guest count before continuing.`;
    const age = message.match(/child is (younger|older) than booking\.child_(?:min|max)_age of (\d+)/);
    if (age) return `A child’s age is outside the allowed range. Children must be ${age[1] === "younger" ? "at least" : "no older than"} ${age[2]} years old. Check the ages entered before continuing.`;
    const booker = message.match(/the booker is (\d+) and booking\.booker_min_age is (\d+)/);
    if (booker) return `The booking holder must be at least ${booker[2]} years old. Check their date of birth or choose an eligible booking holder.`;
    if (/every child needs an age/.test(message)) return "Enter an age for every child so the booking’s age rules and price can be checked.";
    if (/date of birth is required/.test(message)) return "Enter the booking holder’s date of birth so their eligibility can be checked.";
    if (/accept the current terms/.test(message)) return "The guest must accept the current booking terms. Confirm their acceptance before creating the booking.";
    if (/Complete the customer name/.test(message)) return "Complete the customer’s name, email address and telephone number before booking.";
  }
  if (error.code === "WP012" && /selected customer has changed|details differ from the existing customer/.test(message)) {
    return "The entered details do not match the saved customer profile. Select the customer again, or ask an authorised colleague to correct their profile.";
  }
  return MESSAGES[error.code ?? ""] ?? ACTION_UNCONFIRMED;
}

export function readableActionMessage(message: string, fallback = ACTION_UNCONFIRMED): string {
  const code = message.match(/\b(WP\d{3}|23P01|23505|23503|23514|42501|P0002|40001|40P01)\b/)?.[1];
  if (code) return databaseErrorMessage({ code, message });
  if (/no suite is free|no suite is available/i.test(message) && !message.includes("whole visit")) return NO_SUITE_MESSAGE;
  if (!message.trim() || /\b[a-z]+_[a-z_]+\s*:|\bp_[a-z_]+\b|\[§|\bINV-\d|\b(?:sqlstate|postgres|postgrest|constraint|relation|schema cache|unexpected shape|fetch failed|failed to fetch|permission denied|jwt|column)\b/i.test(message)) return fallback;
  if (/^(?:Invalid input|Invalid option|Too small|Too big):/i.test(message)) return "An entry is missing or outside the allowed range. Check the details in the form before trying again.";
  if (/^(?:That did not go through\.?|Something went wrong\.?|Check the form\.?)$/i.test(message.trim())) return "Check the details in this form and try again. If the same problem continues, ask Management for help.";
  if (/Give a reason\. It is stored in the audit log\./.test(message)) return "Enter a short reason for the change so other staff can understand what happened.";
  return message;
}

export function actionErrorTitle(message: string): string {
  if (message.includes("could not confirm whether")) return "Check whether your change was saved";
  if (/No suite is available|selected suite is unavailable/.test(message)) return "This visit does not fit";
  if (message.includes("extra visit or cleaning time overlaps")) return "The extra time is not available";
  if (/This booking has \d+ guests/.test(message)) return "Check the number of guests";
  return "This action needs attention";
}
