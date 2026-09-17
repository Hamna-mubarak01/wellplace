import { describe, expect, it, vi } from "vitest";
import type { WellPlaceClient } from "@/lib/db/types";
import { listOccupancy } from "@/lib/db/queries/board";
import { SCHEDULE_READ_PAGE_SIZE } from "@/lib/config/reception-display";

function clientFor(rows: Record<string, unknown>[], fail = false) {
  const ranges: number[][] = [];
  const from=vi.fn((table:string) => {
    const chain = {
      select:vi.fn(()=>chain),lt:vi.fn(()=>chain),gt:vi.fn(()=>chain),order:vi.fn(()=>chain),
      range:vi.fn(async(start:number,end:number)=>{ranges.push([start,end]);return {data:rows.slice(start,end+1),error:fail?{message:"read failed"}:null};}),

    };
    expect(table).toBe("reception_schedule");
    return chain;
  });
  return {client:{from} as unknown as WellPlaceClient,ranges,from};
}

describe("[§9.1, §9.2] Complete staff schedule reads", () => {
  it("reads every page with guest summaries in the same response", async () => {
    const rows=Array.from({length:SCHEDULE_READ_PAGE_SIZE+1},(_,index)=>({occupancy_id:`o-${index}`,booking_id:`b-${index}`,guest_email:`b-${index}@example.test`,adults:2,children:0,details_unavailable:false}));
    const {client,ranges,from}=clientFor(rows);
    const result=await listOccupancy(client,{from:"2026-09-01T00:00:00Z",to:"2026-10-01T00:00:00Z"});
    expect(result).toHaveLength(rows.length);
    expect(ranges).toEqual([[0,SCHEDULE_READ_PAGE_SIZE-1],[SCHEDULE_READ_PAGE_SIZE,SCHEDULE_READ_PAGE_SIZE*2-1]]);
    expect(from).toHaveBeenCalledTimes(2);
    expect(result.at(-1)?.guestEmail).toBe(`b-${SCHEDULE_READ_PAGE_SIZE}@example.test`);
  });
  it("fails visibly instead of claiming the schedule is empty when a page cannot be read", async () => {
    const log=vi.spyOn(console,"error").mockImplementation(()=>{});
    try {await expect(listOccupancy(clientFor([],true).client,{from:"2026-09-01",to:"2026-10-01"})).rejects.toThrow("The schedule could not be loaded");} finally {log.mockRestore();}
  });
});
