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
describe("Operator Limousine 24", () => {
  it("matches the 24-seat fixture and overnight BL-231 trip", async () => {
    expect((await list()).find((v) => v.type === 4)).toMatchObject({
      plate: "51B-218.52",
      rearSeats: 3,
      disabledSeats: ["A14", "A23"],
      assignment: {
        code: "BL-231",
        origin: "Đà Lạt",
        destination: "TP.HCM",
        time: "23:15 – 05:45",
      },
    });
    const codes = vehicleSeatCodes(4);
    expect(codes).toHaveLength(24);
    expect(new Set(codes).size).toBe(24);
  });
  it("persists rear configuration and permissions without changing other layouts", async () => {
    const others = (await list()).filter((v) => v.type !== 4);
    const config = "/51B-218.52/rear-configuration";
    expect((await request(config, { rearSeats: 4 }, "PATCH")).status).toBe(200);
    expect(
      (await request("/51B-218.52/seats/A25", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    const restored = vehicleSchema.parse(
      await (await request(config, { rearSeats: 3 }, "PATCH")).json(),
    );
    expect(vehicleSeatCodes(restored.type, restored.rearSeats)).toHaveLength(
      24,
    );
    expect(restored.disabledSeats).toEqual(["A14", "A23"]);
    expect((await request(config, { rearSeats: 5 }, "PATCH")).status).toBe(400);
    expect(
      (await request("/51B-218.52/seats/A25", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect((await list()).filter((v) => v.type !== 4)).toEqual(others);
  });
});
