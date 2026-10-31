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
describe("Operator sleeper 36", () => {
  it("matches 18 beds per deck and BL-232 assignment", async () => {
    expect((await list()).find((v) => v.type === 5)).toMatchObject({
      plate: "50B-236.18",
      rearSeats: 3,
      disabledSeats: ["D07", "T11"],
      assignment: {
        code: "BL-232",
        origin: "TP.HCM",
        destination: "Đà Lạt",
        time: "11:00 – 17:30",
      },
    });
    const codes = vehicleSeatCodes(5);
    expect(codes).toHaveLength(36);
    expect(new Set(codes).size).toBe(36);
    expect(codes.filter((c) => c.startsWith("D"))).toHaveLength(18);
    expect(codes.filter((c) => c.startsWith("T"))).toHaveLength(18);
  });
  it("persists rear configuration, validates positions and preserves other vehicles", async () => {
    const others = (await list()).filter((v) => v.type !== 5);
    const config = "/50B-236.18/rear-configuration";
    const response = await request(config, { rearSeats: 5 }, "PATCH");
    expect(response.status).toBe(200);
    const saved = vehicleSchema.parse(await response.json());
    expect(vehicleSeatCodes(saved.type, saved.rearSeats)).toHaveLength(40);
    expect(
      (await request("/50B-236.18/seats/T20", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    const restored = vehicleSchema.parse(
      await (await request(config, { rearSeats: 3 }, "PATCH")).json(),
    );
    expect(restored.disabledSeats).toEqual(["D07", "T11"]);
    expect(
      (await request("/50B-236.18/seats/T20", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect((await request(config, { rearSeats: 2 }, "PATCH")).status).toBe(400);
    expect((await list()).filter((v) => v.type !== 5)).toEqual(others);
  });
});
