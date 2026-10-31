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
describe("Operator sleeper 34", () => {
  it("matches the designed two decks, disabled positions and trip", async () => {
    const vehicle = (await list()).find((v) => v.type === 6);
    expect(vehicle).toMatchObject({
      plate: "72B-221.19",
      rearSeats: 5,
      disabledSeats: ["D07", "T11"],
      assignment: {
        code: "BL-233",
        origin: "TP.HCM",
        destination: "Đà Lạt",
        time: "11:00 – 17:30",
      },
    });
    const codes = vehicleSeatCodes(6);
    expect(codes).toHaveLength(34);
    expect(new Set(codes).size).toBe(34);
    expect(codes.filter((c) => c.startsWith("D"))).toHaveLength(17);
    expect(codes.filter((c) => c.startsWith("T"))).toHaveLength(17);
  });
  it("changes rear rows on both decks while preserving permissions and other vehicles", async () => {
    const others = (await list()).filter((v) => v.type !== 6);
    const config = "/72B-221.19/rear-configuration";
    const saved = vehicleSchema.parse(
      await (await request(config, { rearSeats: 4 }, "PATCH")).json(),
    );
    expect(vehicleSeatCodes(saved.type, saved.rearSeats)).toHaveLength(32);
    expect(
      (await request("/72B-221.19/seats/T17", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect((await request(config, { rearSeats: 3 }, "PATCH")).status).toBe(400);
    expect(
      (await request("/72B-221.19/seats/D07", { enabled: true }, "PATCH"))
        .status,
    ).toBe(200);
    const restored = vehicleSchema.parse(
      await (await request(config, { rearSeats: 5 }, "PATCH")).json(),
    );
    expect(restored.disabledSeats).toEqual(["T11"]);
    expect((await list()).filter((v) => v.type !== 6)).toEqual(others);
    expect(sessionStorage.getItem("blue-operator-vehicles-v2")).toContain(
      '"rearSeats":5',
    );
  });
});
