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
describe("Operator sleeper 22", () => {
  it("has ten lower beds and twelve upper beds with the designed assignment", async () => {
    expect((await list()).find((v) => v.type === 9)).toMatchObject({
      plate: "51B-222.10",
      disabledSeats: ["D07", "T11"],
      assignment: {
        code: "BL-236",
        origin: "TP.HCM",
        destination: "Đà Lạt",
        time: "11:00 – 17:30",
      },
    });
    const codes = vehicleSeatCodes(9);
    expect(codes).toHaveLength(22);
    expect(new Set(codes).size).toBe(22);
    expect(codes.filter((c) => c.startsWith("D"))).toHaveLength(10);
    expect(codes.filter((c) => c.startsWith("T"))).toHaveLength(12);
  });
  it("validates real bed positions and keeps other vehicles unchanged", async () => {
    const others = (await list()).filter((v) => v.type !== 9);
    expect(
      (await request("/51B-222.10/seats/T12", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    expect(
      (await request("/51B-222.10/seats/D11", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          "/51B-222.10/rear-configuration",
          { rearSeats: 4 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect((await list()).find((v) => v.type === 9)?.disabledSeats).toContain(
      "T12",
    );
    expect((await list()).filter((v) => v.type !== 9)).toEqual(others);
  });
  it("migrates the old placeholder D11 permission without discarding other saved vehicles", async () => {
    const previous = await list();
    sessionStorage.setItem(
      "blue-operator-vehicles-v2",
      JSON.stringify(
        previous.map((v) =>
          v.type === 9 ? { ...v, disabledSeats: ["D07", "D11"] } : v,
        ),
      ),
    );
    const migrated = await list();
    expect(migrated.find((v) => v.type === 9)?.disabledSeats).toEqual([
      "D07",
      "T12",
    ]);
    expect(migrated.filter((v) => v.type !== 9)).toEqual(
      previous.filter((v) => v.type !== 9),
    );
  });
});
