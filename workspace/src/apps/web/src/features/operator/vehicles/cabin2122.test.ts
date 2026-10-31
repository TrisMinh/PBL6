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
describe("Operator Cabin 21–22", () => {
  it("matches 10 lower and 12 upper rooms and BL-240 fixture", async () => {
    expect((await list()).find((v) => v.type === 13)).toMatchObject({
      plate: "51B-221.22",
      cabinCapacity: 22,
      disabledSeats: ["D07", "T11"],
      assignment: {
        code: "BL-240",
        origin: "TP.HCM",
        destination: "Đà Lạt",
        time: "11:00 – 17:30",
      },
    });
    expect(vehicleSeatCodes(13).filter((c) => c.startsWith("D"))).toHaveLength(
      10,
    );
    expect(vehicleSeatCodes(13).filter((c) => c.startsWith("T"))).toHaveLength(
      12,
    );
  });
  it("persists 21-room configuration and validates room availability without changing other vehicles", async () => {
    const others = (await list()).filter((v) => v.type !== 13);
    const path = "/51B-221.22/cabin-configuration";
    const response = await request(path, { cabinCapacity: 21 }, "PATCH");
    expect(response.status).toBe(200);
    const saved = vehicleSchema.parse(await response.json());
    expect(saved.cabinCapacity).toBe(21);
    expect(vehicleSeatCodes(13, undefined, 21)).toHaveLength(21);
    expect(
      (await request("/51B-221.22/seats/D10", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect(
      (await request("/51B-221.22/seats/T12", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    expect((await request(path, { cabinCapacity: 23 }, "PATCH")).status).toBe(
      400,
    );
    expect(
      (
        await request(
          "/79B-225.40/cabin-configuration",
          { cabinCapacity: 21 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect((await request(path, { cabinCapacity: 22 }, "PATCH")).status).toBe(
      200,
    );
    expect((await list()).find((v) => v.type === 13)?.disabledSeats).toContain(
      "T12",
    );
    expect((await list()).filter((v) => v.type !== 13)).toEqual(others);
  });
  it("preserves saved legacy placeholder permissions", async () => {
    const previous = await list();
    sessionStorage.setItem(
      "blue-operator-vehicles-v2",
      JSON.stringify(
        previous.map((v) =>
          v.type === 13 ? { ...v, disabledSeats: ["D07", "D11"] } : v,
        ),
      ),
    );
    const migrated = await list();
    expect(migrated.find((v) => v.type === 13)?.disabledSeats).toEqual([
      "D07",
      "T12",
    ]);
    expect(migrated.filter((v) => v.type !== 13)).toEqual(
      previous.filter((v) => v.type !== 13),
    );
  });
});
