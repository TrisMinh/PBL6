import { describe, it, expect } from "vitest";
import {
  cancellationMinutes,
  refundLevel,
  refundListSchema,
  refundLeadLabel,
} from "./refunds.schema";
const endpoint = new URL(
  "/api/v1/operator/refund-requests-preview",
  window.location.origin,
);
async function request(query = ""): Promise<Response> {
  return fetch(`${endpoint}${query}`);
}
describe("Operator cancellation/refund preview", () => {
  it("returns the six designed requests with derived lead times and levels", async () => {
    const data = refundListSchema.parse(await (await request()).json());
    expect(data.total).toBe(6);
    expect(
      data.items.map((item) =>
        cancellationMinutes(item.requestedAt, item.departureAt),
      ),
    ).toEqual([3000, 1620, 555, 135, 105, 710]);
    expect(
      data.items.map((item) =>
        refundLevel(cancellationMinutes(item.requestedAt, item.departureAt)),
      ),
    ).toEqual(["level1", "level1", "level2", "level3", "exception", "level2"]);
    expect(data.items[0]).toMatchObject({
      bookingCode: "BK-0905-018",
      customer: "Nguyễn Văn An",
      seats: ["A01", "A02"],
    });
  });
  it("applies search without accents/phone spacing, status, level and date together", async () => {
    for (const query of [
      "?search=nguyen%20van%20an",
      "?search=0901234567",
      "?search=bk-0905-018",
    ]) {
      const result = refundListSchema.parse(
        await (await request(query)).json(),
      );
      expect(result.items.map((i) => i.bookingCode)).toEqual(["BK-0905-018"]);
    }
    const result = refundListSchema.parse(
      await (
        await request("?status=processing&level=level2&date=2026-09-05")
      ).json(),
    );
    expect(result.total).toBe(1);
    expect(result.items.map((i) => i.bookingCode)).toEqual(["BK-0905-015"]);
    expect(
      refundListSchema.parse(await (await request("?date=2026-09-06")).json())
        .total,
    ).toBe(0);
  });
  it("rejects malformed filters rather than returning unfiltered requests", async () => {
    for (const query of [
      "?date=2026-02-30",
      "?date=05/09/2026",
      "?status=bad",
      "?level=4",
      `?search=${"x".repeat(101)}`,
    ])
      expect((await request(query)).status).toBe(400);
  });
  it("uses inclusive 24h/6h/2h boundaries and handles cross-day/timezone timestamps", () => {
    expect([1440, 1439, 360, 359, 120, 119, 0, -1].map(refundLevel)).toEqual([
      "level1",
      "level2",
      "level2",
      "level3",
      "level3",
      "exception",
      "exception",
      "exception",
    ]);
    expect(
      cancellationMinutes(
        "2026-09-05T23:00:00+07:00",
        "2026-09-06T01:00:00+07:00",
      ),
    ).toBe(120);
    expect(
      cancellationMinutes("2026-09-05T16:00:00Z", "2026-09-06T01:00:00+07:00"),
    ).toBe(120);
    expect(refundLeadLabel(3000)).toBe("2 ngày 2 giờ");
    expect(refundLeadLabel(105)).toBe("1 giờ 45 phút");
  });
});
