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
describe("Operator Limousine 22 cabin", () => {
  it("matches ten lower and twelve upper cabins and BL-241 assignment", async () => {
    expect((await list()).find((v) => v.type === 14)).toMatchObject({
      plate: "51B-222.22",
      disabledSeats: ["D07", "T11"],
      assignment: {
        code: "BL-241",
        origin: "TP.HCM",
        destination: "Đà Lạt",
        time: "11:00 – 17:30",
      },
    });
    const codes = vehicleSeatCodes(14);
    expect(codes).toHaveLength(22);
    expect(new Set(codes).size).toBe(22);
    expect(codes.filter((c) => c.startsWith("D"))).toHaveLength(10);
    expect(codes.filter((c) => c.startsWith("T"))).toHaveLength(12);
  });
  it("validates cabin codes and preserves the fleet when saving permissions", async () => {
    const others = (await list()).filter((v) => v.type !== 14);
    expect(
      (await request("/51B-222.22/seats/T12", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    expect(
      (await request("/51B-222.22/seats/D11", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          "/51B-222.22/cabin-configuration",
          { cabinCapacity: 21 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect((await list()).find((v) => v.type === 14)?.disabledSeats).toContain(
      "T12",
    );
    expect((await list()).filter((v) => v.type !== 14)).toEqual(others);
  });
  it("preserves legacy permissions when replacing the old 11+11 placeholder", async () => {
    const previous = await list();
    sessionStorage.setItem(
      "blue-operator-vehicles-v2",
      JSON.stringify(
        previous.map((v) =>
          v.type === 14 ? { ...v, disabledSeats: ["D07", "D11"] } : v,
        ),
      ),
    );
    const migrated = await list();
    expect(migrated.find((v) => v.type === 14)?.disabledSeats).toEqual([
      "D07",
      "T12",
    ]);
    expect(migrated.filter((v) => v.type !== 14)).toEqual(
      previous.filter((v) => v.type !== 14),
    );
  });
});
