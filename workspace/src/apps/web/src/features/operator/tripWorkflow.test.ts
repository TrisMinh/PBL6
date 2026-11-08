import { describe, expect, it } from "vitest";
import {
  resourceIssues,
  tripInput,
  vietnamIso,
  vietnamLocal,
  type TripForm,
} from "./tripWorkflow";

const valid: TripForm = {
  routeId: "route",
  busId: "bus",
  driverId: "driver",
  departureAt: "2027-04-01T08:00",
  arrivalAt: "2027-04-01T11:00",
  fare: "180000",
};

describe("real operator trip input", () => {
  it("keeps Vietnam departure time across a server round trip", () => {
    expect(vietnamIso(valid.departureAt)).toBe("2027-04-01T01:00:00.000Z");
    expect(vietnamLocal(vietnamIso(valid.departureAt))).toBe(valid.departureAt);
    expect(tripInput(valid).fare).toEqual({ amount: 180000, currency: "VND" });
  });
  it("rejects missing resources and arrival before or equal to departure", () => {
    expect(() => tripInput({ ...valid, driverId: "" })).toThrow(
      "Vui lòng nhập đủ",
    );
    expect(() => tripInput({ ...valid, arrivalAt: valid.departureAt })).toThrow(
      "Giờ đến phải sau giờ đi",
    );
    expect(() =>
      tripInput({ ...valid, arrivalAt: "2027-04-01T07:59" }),
    ).toThrow("Giờ đến phải sau giờ đi");
  });
  it("allows overnight trips and rejects non-positive or fractional fares", () => {
    expect(
      tripInput({ ...valid, arrivalAt: "2027-04-02T02:00" }).arrivalAt,
    ).toBe("2027-04-01T19:00:00.000Z");
    for (const fare of ["0", "-1", "12.5", "abc"])
      expect(() => tripInput({ ...valid, fare })).toThrow("Giá vé");
  });
  it("reports disabled resources, seats and expired licences", () => {
    const issues = resourceIssues(
      {
        id: "bus",
        plateNumber: "43B-068.79",
        type: "SLEEPER_34",
        status: "DISABLED",
        seats: [{ code: "A01", enabled: false }],
      },
      {
        id: "driver",
        userId: "user",
        licenseNumber: "480123456789",
        licenseExpiresOn: "2027-03-31",
        status: "ACTIVE",
      },
      "2027-04-01T04:00:00Z",
      {
        id: "route",
        name: "Đà Nẵng → Huế",
        origin: "Đà Nẵng",
        destination: "Huế",
        status: "ACTIVE",
        stops: [],
      },
    );
    expect(issues).toEqual([
      "Xe chưa được chọn hoặc không còn hoạt động.",
      "Xe chưa có ghế được phép bán.",
      "GPLX của tài xế hết hạn trước khi kết thúc chuyến.",
    ]);
  });
});
