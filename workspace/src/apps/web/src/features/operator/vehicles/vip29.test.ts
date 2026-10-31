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
describe("VIP 29 Operator layout", () => {
  it("matches the designed seats, disabled positions and overnight trip", async () => {
    const vehicle = (await list()).find((v) => v.type === 2);
    expect(vehicle).toMatchObject({
      plate: "49B-214.08",
      rearSeats: 5,
      disabledSeats: ["A14", "A23"],
      assignment: {
        code: "BL-214",
        origin: "Đà Lạt",
        destination: "TP.HCM",
        time: "23:15 – 05:45",
      },
    });
    expect(vehicleSeatCodes(2)).toHaveLength(29);
    expect(new Set(vehicleSeatCodes(2)).size).toBe(29);
  });
  it("persists permissions and valid rear configurations without changing other vehicles", async () => {
    const original = (await list()).filter((v) => v.type !== 2);
    const seatPath = "/49B-214.08/seats/A14";
    const enabled = vehicleSchema.parse(
      await (await request(seatPath, { enabled: true }, "PATCH")).json(),
    );
    expect(enabled.disabledSeats).not.toContain("A14");
    const config = "/49B-214.08/rear-configuration";
    const saved = vehicleSchema.parse(
      await (await request(config, { rearSeats: 4 }, "PATCH")).json(),
    );
    expect(vehicleSeatCodes(saved.type, saved.rearSeats)).toHaveLength(28);
    expect(
      (await request("/49B-214.08/seats/A29", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect((await request(config, { rearSeats: 3 }, "PATCH")).status).toBe(400);
    expect(
      (
        await request(
          "/51B-208.36/rear-configuration",
          { rearSeats: 5 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    const restored = vehicleSchema.parse(
      await (await request(config, { rearSeats: 5 }, "PATCH")).json(),
    );
    expect(restored.disabledSeats).toContain("A23");
    expect(restored.disabledSeats).not.toContain("A14");
    expect((await list()).filter((v) => v.type !== 2)).toEqual(original);
  });
});
