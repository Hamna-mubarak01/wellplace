import type { BoardData, BoardEntry, BoardState } from "@/components/console/reception/board-types";
import type { ArrivalRow } from "@/lib/db/queries/bookings";

export const RECEPTION_PREVIEW = {
  intervalMinutes: 15,
  durationsHours: [2, 3, 4, 5, 6],
  bufferMinutes: 20,
  overdueAfterMinutes: 15,
  openingHour: "10:00",
  closingHour: "22:00",
  suiteCount: 7,
  notes: [
    { id: "desk-note-1", author: "Laila Hassan", time: "11:15", body: "The afternoon guests in Suite 2 have asked for extra towels. Two sets are ready in the reception cupboard." },
    { id: "desk-note-2", author: "Samir Khan", time: "12:30", body: "The technician will check Suite 7 this afternoon. Keep the maintenance block in place until the visit is complete." },
    { id: "desk-note-3", author: "Maya Patel", time: "13:10", body: "A phone charger was found after the morning session. It is labelled and stored at the front desk." },
  ],
} as const;

const VISITS: readonly [number, string, string, string, BoardState][] = [
  [1, "Alex Morgan", "10:00", "12:00", "completed"], [1, "Riya Shah", "13:00", "16:00", "checked_in"], [1, "Omar Faris", "18:00", "21:00", "booked"],
  [2, "Sofia Reed", "10:30", "13:30", "cleaning"], [2, "Daniel Brooks", "15:00", "18:00", "booked"], [2, "Layla Amin", "19:00", "21:00", "booked"],
  [3, "Ethan Cole", "11:00", "14:00", "checked_in"], [3, "Zara Malik", "16:00", "19:00", "hold"],
  [4, "Mila Foster", "10:00", "12:00", "completed"], [4, "Noah Bennett", "14:00", "17:00", "booked"],
  [5, "Aisha Karim", "12:00", "15:00", "checked_in"], [5, "Leo Martin", "17:00", "20:00", "booked"],
  [6, "Amira Saleh", "11:00", "13:00", "completed"], [6, "Private event", "15:00", "19:00", "block"],
  [7, "Equipment service", "13:00", "16:00", "maintenance"], [7, "James Taylor", "18:00", "21:00", "booked"],
];

export function receptionPreviewData(date: string): { board: BoardData; arrivals: ArrivalRow[] } {
  const at = (time: string) => new Date(`${date}T${time}:00+04:00`).toISOString();
  const statuses = ["checked_in", "cleaning", "checked_in", "available", "checked_in", "available", "maintenance"] as const;
  const suites = Array.from({ length: RECEPTION_PREVIEW.suiteCount }, (_, index) => ({ id: `suite-preview-${index + 1}`, suiteNumber: index + 1, status: statuses[index], internalNote: null }));
  const entries: BoardEntry[] = VISITS.map(([suite, name, start, end, state], index) => {
    const block = state === "block" || state === "maintenance";
    return {
      id: `visit-preview-${index}`, suiteId: suites[suite - 1].id, bookingId: block ? null : `booking-preview-${index}`,
      bookingReference: block ? null : `WP-B${index + 1040}`, guestName: block ? null : name, state,
      guestEmail: block ? null : `${name.toLowerCase().replaceAll(" ",".")}@example.test`,
      guestPhone: block ? null : "+971 50 000 0000", adults: block ? undefined : 2, children: block ? undefined : 1,
      paymentStatus: block ? null : state === "hold" ? "pending" : "paid",
      detail: block ? undefined : { guestEmail: `${name.toLowerCase().replaceAll(" ",".")}@example.test`, guestPhone: "+971 50 000 0000", adults: 2, children: 1, totalFils: 66000, source: "online", addons: [{name:"Towel",quantity:3,unitPriceFils:0,lineTotalFils:0}], personalRequest: "Please prepare an extra towel for our child.", internalNote: null, warningNote: null, guests: [{kind:"adult",age:null},{kind:"adult",age:null},{kind:"child",age:10}], isComplimentary:false },
      experienceStart: at(start), experienceEnd: at(end),
      blockedEnd: new Date(Date.parse(at(end)) + (block ? 0 : RECEPTION_PREVIEW.bufferMinutes * 60_000)).toISOString(),
      holdExpiresAt: state === "hold" ? at("15:40") : null, reason: block ? name : null,
    };
  });
  return {
    board: { window: { start: at(RECEPTION_PREVIEW.openingHour), end: at(RECEPTION_PREVIEW.closingHour) }, suites, entries },
    arrivals: entries.filter((entry) => entry.state === "booked").toSorted((a, b) => a.experienceStart.localeCompare(b.experienceStart)).map((entry) => ({
      id: entry.bookingId!, reference: entry.bookingReference!, guestName: entry.guestName!, guestPhone: "", suiteNumber: suites.find((suite) => suite.id === entry.suiteId)!.suiteNumber,
      startsAt: entry.experienceStart, adults: 2, children: 0, arrivedAt: null, status: "confirmed",
    })),
  };
}
