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
describe("Operator sleeper 30", () => {
  it("has 15 beds on each deck with the designed BL-234 assignment", async () => {
    expect((await list()).find((v) => v.type === 7)).toMatchObject({
      plate: "51B-230.30",
      rearSeats: 3,
      disabledSeats: ["D07", "T11"],
      assignment: {
        code: "BL-234",
        origin: "TP.HCM",
        destination: "Đà Lạt",
        time: "11:00 – 17:30",
      },
    });
    const codes = vehicleSeatCodes(7);
    expect(codes).toHaveLength(30);
    expect(new Set(codes).size).toBe(30);
    expect(codes.filter((c) => c.startsWith("D"))).toHaveLength(15);
    expect(codes.filter((c) => c.startsWith("T"))).toHaveLength(15);
  });
  it("changes both rear rows, validates positions and preserves other vehicles", async () => {
    const others = (await list()).filter((v) => v.type !== 7);
    const config = "/51B-230.30/rear-configuration";
    const enlarged = vehicleSchema.parse(
      await (await request(config, { rearSeats: 5 }, "PATCH")).json(),
    );
    expect(vehicleSeatCodes(enlarged.type, enlarged.rearSeats)).toHaveLength(
      34,
    );
    expect(
      (await request("/51B-230.30/seats/T17", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    const saved = vehicleSchema.parse(
      await (await request(config, { rearSeats: 3 }, "PATCH")).json(),
    );
    expect(saved.disabledSeats).toEqual(["D07", "T11"]);
    expect(
      (await request("/51B-230.30/seats/T17", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect((await request(config, { rearSeats: 2 }, "PATCH")).status).toBe(400);
    expect((await list()).filter((v) => v.type !== 7)).toEqual(others);
  });
});
