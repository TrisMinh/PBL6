import { describe, it, expect } from "vitest";
import { z } from "zod";
import { vehicleSchema, vehicleSeatCodes } from "./vehicles.schema";
async function request(
  path = "",
  body?: unknown,
  method = "GET",
): Promise<Response> {
  return fetch(
    new URL(`/api/v1/operator/vehicles-preview${path}`, window.location.origin),
    {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}
async function list(): Promise<ReturnType<typeof vehicleSchema.parse>[]> {
  return z
    .object({ items: z.array(vehicleSchema) })
    .parse(await (await request()).json()).items;
}
describe("Operator Cabin 24", () => {
  it("has 12 rooms per deck and the designed BL-239 assignment", async () => {
    expect((await list()).find((v) => v.type === 12)).toMatchObject({
      plate: "79B-225.40",
      disabledSeats: ["D07", "T11"],
      assignment: {
        code: "BL-239",
        origin: "TP.HCM",
        destination: "Đà Lạt",
        time: "11:00 – 17:30",
      },
    });
    const codes = vehicleSeatCodes(12);
    expect(codes).toHaveLength(24);
    expect(new Set(codes).size).toBe(24);
    expect(codes.filter((c) => c.startsWith("D"))).toHaveLength(12);
    expect(codes.filter((c) => c.startsWith("T"))).toHaveLength(12);
  });
  it("persists room permission, rejects nonexistent rooms and preserves other vehicles", async () => {
    const others = (await list()).filter((v) => v.type !== 12);
    expect(
      (await request("/79B-225.40/seats/D12", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    expect(
      (await request("/79B-225.40/seats/T13", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          "/79B-225.40/rear-configuration",
          { rearSeats: 4 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect((await list()).find((v) => v.type === 12)?.disabledSeats).toContain(
      "D12",
    );
    expect((await list()).filter((v) => v.type !== 12)).toEqual(others);
  });
});
