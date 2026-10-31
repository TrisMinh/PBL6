import { describe, it, expect } from "vitest";
import { bookingsResponseSchema } from "./bookings.schema";
async function request(params: Record<string, string> = {}): Promise<Response> {
  const url = new URL(
    "/api/v1/operator/bookings-preview",
    window.location.origin,
  );
  url.search = new URLSearchParams(params).toString();
  return fetch(url);
}
describe("Operator recent bookings", () => {
  it("paginates actual mock rows without duplicates", async () => {
    const first = bookingsResponseSchema.parse(await (await request()).json());
    const second = bookingsResponseSchema.parse(
      await (await request({ page: "2" })).json(),
    );
    expect(first.total).toBe(1056);
    expect(first.items).toHaveLength(9);
    expect(first.items[0].id).toBe("BK-260905-018");
    expect(second.page).toBe(2);
    expect(
      second.items.every(
        (item) => !first.items.some((old) => old.id === item.id),
      ),
    ).toBe(true);
    const last = bookingsResponseSchema.parse(
      await (await request({ page: "9999" })).json(),
    );
    expect(last.page).toBe(118);
    expect(last.items).toHaveLength(3);
  });
  it("combines name/phone search, booking status and payment filters", async () => {
    const found = bookingsResponseSchema.parse(
      await (
        await request({
          search: "tran thu ha",
          status: "pending",
          payment: "unpaid",
        })
      ).json(),
    );
    expect(found.total).toBeGreaterThan(0);
    expect(
      found.items.every(
        (item) =>
          item.name === "Trần Thu Hà" &&
          item.status === "pending" &&
          item.payment === "unpaid",
      ),
    ).toBe(true);
    const phone = bookingsResponseSchema.parse(
      await (await request({ search: "0901000000" })).json(),
    );
    expect(phone.total).toBe(1);
    expect(phone.items[0].id).toBe("BK-260905-018");
    const empty = bookingsResponseSchema.parse(
      await (await request({ status: "cancelled", payment: "unpaid" })).json(),
    );
    expect(empty.total).toBe(0);
  });
  it("filters by creation date and rejects invalid date intervals", async () => {
    const result = bookingsResponseSchema.parse(
      await (await request({ from: "2026-09-05", to: "2026-09-05" })).json(),
    );
    expect(result.total).toBe(120);
    expect(
      result.items.some((item) => item.departureDate === "2026-09-06"),
    ).toBe(true);
    expect(
      (await request({ from: "2026-09-06", to: "2026-09-05" })).status,
    ).toBe(400);
    expect((await request({ page: "0" })).status).toBe(400);
  });
});
