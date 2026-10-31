import { describe, it, expect } from "vitest";
import { refundTrackingSchema, estimateRefund } from "./refundTracking.schema";
import { cancellationMinutes, refundListSchema } from "./refunds.schema";
const endpoint = new URL(
  "/api/v1/operator/refund-requests-preview",
  window.location.origin,
);
describe("Refund tracking preview", () => {
  it("returns the designed refund case and calculates 576,000 from the cancelled tickets value", async () => {
    const response = await fetch(`${endpoint}/BK-0905-018`);
    expect(response.status).toBe(200);
    const item = refundTrackingSchema.parse(await response.json());
    expect(item).toMatchObject({
      bookingCode: "BK-0905-018",
      cancelledTickets: 2,
      cancellationValue: 640000,
      status: "processing",
      paymentMethod: "VNPay",
      refundReference: "RF-0905-018",
    });
    expect(
      estimateRefund(
        item.cancellationValue,
        cancellationMinutes(item.requestedAt, item.departureAt),
      ),
    ).toEqual({ fee: 64000, refund: 576000 });
    const list = refundListSchema.parse(await (await fetch(endpoint)).json());
    expect(
      list.items.find((i) => i.bookingCode === item.bookingCode)?.status,
    ).toBe(item.status);
  });
  it("uses exact 24h/6h/2h thresholds and leaves exceptions/unknown ticket value unestimated", () => {
    expect(
      [1440, 1439, 360, 359, 120].map(
        (minutes) => estimateRefund(640000, minutes)?.refund,
      ),
    ).toEqual([576000, 512000, 512000, 448000, 448000]);
    expect(estimateRefund(640000, 119)).toBeNull();
    expect(estimateRefund(null, 3000)).toBeNull();
    expect(estimateRefund(333, 1440)).toEqual({ fee: 33, refund: 300 });
  });
  it("keeps exception financial data empty and returns 404 for unknown codes", async () => {
    for (const code of ["BK-0905-012"]) {
      const item = refundTrackingSchema.parse(
        await (await fetch(`${endpoint}/${code}`)).json(),
      );
      expect(item.bookingCode).toBe(code);
      expect(item.cancellationValue).toBeNull();
    }
    expect((await fetch(`${endpoint}/BK-UNKNOWN`)).status).toBe(404);
  });
});

describe("Completed refund case", () => {
  it("returns completed BK-0905-017 and applies Level 1 for its 27-hour lead time", async () => {
    const item = refundTrackingSchema.parse(
      await (await fetch(endpoint + "/BK-0905-017")).json(),
    );
    expect(item).toMatchObject({
      customer: "Trần Thu Hà",
      cancelledTickets: 1,
      cancellationValue: 260000,
      status: "completed",
      paymentMethod: "VNPay",
      refundReference: "RF-0905-017",
    });
    const minutes = cancellationMinutes(item.requestedAt, item.departureAt);
    expect(minutes).toBe(1620);
    expect(estimateRefund(item.cancellationValue, minutes)).toEqual({
      fee: 26000,
      refund: 234000,
    });
    const list = refundListSchema.parse(
      await (await fetch(endpoint + "?status=completed&level=level1")).json(),
    );
    expect(list.items.map((i) => i.bookingCode)).toEqual(["BK-0905-017"]);
    const unchanged = refundTrackingSchema.parse(
      await (await fetch(endpoint + "/BK-0905-018")).json(),
    );
    expect(unchanged).toMatchObject({
      cancellationValue: 640000,
      status: "processing",
      refundReference: "RF-0905-018",
    });
  });
});

describe("Level 2 processing case", () => {
  it("returns BK-0905-015 with timeline progress, 20% fee and 180,000 estimated refund", async () => {
    const item = refundTrackingSchema.parse(
      await (await fetch(endpoint + "/BK-0905-015")).json(),
    );
    expect(item).toMatchObject({
      customer: "Phạm Ngọc Mai",
      cancelledTickets: 2,
      cancellationValue: 225000,
      status: "processing",
      paymentMethod: "VNPay",
      refundReference: "RF-0905-015",
      progressLayout: "timeline",
    });
    const minutes = cancellationMinutes(item.requestedAt, item.departureAt);
    expect(minutes).toBe(555);
    expect(estimateRefund(item.cancellationValue, minutes)).toEqual({
      fee: 45000,
      refund: 180000,
    });
    const list = refundListSchema.parse(
      await (
        await fetch(
          endpoint + "?status=processing&level=level2&search=BK-0905-015",
        )
      ).json(),
    );
    expect(list.items.map((i) => i.bookingCode)).toEqual(["BK-0905-015"]);
    for (const code of ["BK-0905-018", "BK-0905-017"]) {
      const previous = refundTrackingSchema.parse(
        await (await fetch(endpoint + "/" + code)).json(),
      );
      expect(previous.progressLayout).toBe("standard");
    }
  });
});

describe("Level 3 processing case", () => {
  it("returns BK-0905-016 with 135-minute lead time, timeline progress and 224,000 refund", async () => {
    const item = refundTrackingSchema.parse(
      await (await fetch(endpoint + "/BK-0905-016")).json(),
    );
    expect(item).toMatchObject({
      customer: "Lê Minh Khang",
      cancelledTickets: 2,
      cancellationValue: 320000,
      status: "processing",
      paymentMethod: "VNPay",
      refundReference: "RF-0905-016",
      progressLayout: "timeline",
      seats: ["B01", "B02"],
    });
    const minutes = cancellationMinutes(item.requestedAt, item.departureAt);
    expect(minutes).toBe(135);
    expect(estimateRefund(item.cancellationValue, minutes)).toEqual({
      fee: 96000,
      refund: 224000,
    });
    const list = refundListSchema.parse(
      await (await fetch(endpoint + "?status=processing&level=level3")).json(),
    );
    expect(list.items.map((i) => i.bookingCode)).toEqual(["BK-0905-016"]);
    for (const [code, value, status] of [
      ["018", 640000, "processing"],
      ["017", 260000, "completed"],
      ["015", 225000, "processing"],
    ]) {
      const previous = refundTrackingSchema.parse(
        await (await fetch(endpoint + "/BK-0905-" + code)).json(),
      );
      expect(previous).toMatchObject({ cancellationValue: value, status });
    }
  });
});

describe("Exception tracking case", () => {
  it("keeps BK-0905-012 tickets intact, creates no refund and leaves it outside all three policy tiers", async () => {
    const item = refundTrackingSchema.parse(
      await (await fetch(endpoint + "/BK-0905-012")).json(),
    );
    expect(item).toMatchObject({
      customer: "Bùi Khánh Linh",
      status: "exception",
      cancelledTickets: 0,
      cancellationValue: null,
      paymentMethod: null,
      refundReference: null,
      progressLayout: "timeline",
      seats: ["B08"],
    });
    const minutes = cancellationMinutes(item.requestedAt, item.departureAt);
    expect(minutes).toBe(105);
    expect(estimateRefund(320000, minutes)).toBeNull();
    const list = refundListSchema.parse(
      await (
        await fetch(endpoint + "?status=exception&level=exception")
      ).json(),
    );
    expect(list.items.map((i) => i.bookingCode)).toEqual(["BK-0905-012"]);
  });
});

describe("Cross-day completed case", () => {
  it("returns BK-0905-013 completed across midnight with Level 2 fee and 104,000 refund", async () => {
    const item = refundTrackingSchema.parse(
      await (await fetch(endpoint + "/BK-0905-013")).json(),
    );
    expect(item).toMatchObject({
      customer: "Đỗ Minh Anh",
      status: "completed",
      cancelledTickets: 1,
      cancellationValue: 130000,
      paymentMethod: "VNPay",
      refundReference: "RF-0905-013",
      progressLayout: "timeline",
      seats: ["D02"],
    });
    const minutes = cancellationMinutes(item.requestedAt, item.departureAt);
    expect(minutes).toBe(710);
    expect(estimateRefund(item.cancellationValue, minutes)).toEqual({
      fee: 26000,
      refund: 104000,
    });
    const list = refundListSchema.parse(
      await (await fetch(endpoint + "?status=completed&level=level2")).json(),
    );
    expect(list.items.map((i) => i.bookingCode)).toEqual(["BK-0905-013"]);
  });
});
