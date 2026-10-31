import { describe, it, expect } from "vitest";
import {
  tripListsResponseSchema,
  tripPassengersResponseSchema,
} from "./tripLists.schema";
async function get(path: string): Promise<Response> {
  return fetch(new URL(`/api/v1/operator/${path}`, window.location.origin));
}
describe("Operator trip passenger lists", () => {
  it("applies start date, accent-insensitive route search and combined filters", async () => {
    const all = tripListsResponseSchema.parse(
      await (await get("passenger-trips")).json(),
    );
    expect(all.items).toHaveLength(8);
    const later = tripListsResponseSchema.parse(
      await (await get("passenger-trips?date=2026-09-06")).json(),
    );
    expect(later.items).toHaveLength(4);
    const combined = tripListsResponseSchema.parse(
      await (
        await get("passenger-trips?search=da%20lat&status=conflict")
      ).json(),
    );
    expect(combined.items.map((item) => item.id)).toEqual(["BL-211"]);
    expect((await get("passenger-trips?date=2026-02-31")).status).toBe(400);
  });
  it("returns passenger counts matching trip totals and valid empty/not-found states", async () => {
    const full = tripPassengersResponseSchema.parse(
      await (await get("passenger-trips/BL-204/passengers")).json(),
    );
    expect(full.passengers).toHaveLength(full.trip.booked);
    expect(new Set(full.passengers.map((p) => p.seat)).size).toBe(
      full.trip.booked,
    );
    expect(full.passengers.filter((p) => p.confirmed)).toHaveLength(
      full.trip.checkedIn,
    );
    const empty = tripPassengersResponseSchema.parse(
      await (await get("passenger-trips/BL-211/passengers")).json(),
    );
    expect(empty.passengers).toHaveLength(0);
    expect((await get("passenger-trips/UNKNOWN/passengers")).status).toBe(404);
  });
  it("keeps ticket confirmation separate from actual check-in", async () => {
    const result = tripPassengersResponseSchema.parse(
      await (await get("passenger-trips/BL-204/passengers")).json(),
    );
    expect(result.trip.driver).toBe("Hoàng Nam");
    expect(result.passengers).toHaveLength(12);
    expect(result.passengers[0]).toMatchObject({
      ticketCode: "VE-204-A1",
      name: "Nguyễn Văn An",
      boardingStatus: "confirmed",
      confirmed: false,
    });
    expect(result.trip.checkedIn).toBe(0);
    expect(result.passengers.filter((person) => person.confirmed)).toHaveLength(
      0,
    );
    expect(
      result.passengers.find((person) => person.ticketCode === "VE-204-A5")
        ?.payment,
    ).toBe("unpaid");
    expect(
      new Set(result.passengers.map((person) => person.ticketCode)).size,
    ).toBe(12);
  });
});
