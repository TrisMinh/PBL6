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
describe("Limousine 11 configuration", () => {
  it("uses BL-208 assignment, 11 positions and disabled 07 in the Figma fixture", async () => {
    const vehicles = await list();
    const vehicle = vehicles.find((v) => v.id === "51B-208.36");
    expect(vehicle).toMatchObject({
      type: 1,
      rearSeats: 3,
      disabledSeats: ["A07"],
      assignment: {
        code: "BL-208",
        destination: "Nha Trang",
        time: "13:30 – 20:00",
      },
    });
    expect(vehicleSeatCodes(1)).toEqual(
      Array.from(
        { length: 11 },
        (_, index) => `A${String(index + 1).padStart(2, "0")}`,
      ),
    );
  });
  it("persists changes in rear layout and validates each vehicle's real positions", async () => {
    const before = (await list()).find((v) => v.type === 0);
    const path = "/51B-208.36/rear-configuration";
    const response = await request(path, { rearSeats: 4 }, "PATCH");
    expect(response.status).toBe(200);
    const saved = vehicleSchema.parse(await response.json());
    expect(saved.rearSeats).toBe(4);
    expect(vehicleSeatCodes(saved.type, saved.rearSeats)).toHaveLength(12);
    expect(
      (await request("/51B-208.36/seats/A12", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    expect((await request(path, { rearSeats: 3 }, "PATCH")).status).toBe(200);
    expect(
      (await request("/51B-208.36/seats/A12", { enabled: true }, "PATCH"))
        .status,
    ).toBe(400);
    expect((await request(path, { rearSeats: 8 }, "PATCH")).status).toBe(400);
    expect(
      (
        await request(
          "/45B-204.12/rear-configuration",
          { rearSeats: 4 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect((await list()).find((v) => v.type === 0)).toEqual(before);
    expect(sessionStorage.getItem("blue-operator-vehicles-v2")).toContain(
      '"rearSeats":3',
    );
  });
  it("keeps saved legacy vehicle permissions while enriching limousine details", async () => {
    const vehicles = await list();
    sessionStorage.removeItem("blue-operator-vehicles-v2");
    const legacy = vehicles.map((v) => {
      const { rearSeats, ...rest } = v;
      void rearSeats;
      return v.type === 1
        ? { ...rest, assignment: null, disabledSeats: ["A01", "A07"] }
        : rest;
    });
    sessionStorage.setItem("blue-operator-vehicles-v1", JSON.stringify(legacy));
    const migrated = (await list()).find((v) => v.type === 1);
    expect(migrated).toMatchObject({
      rearSeats: 3,
      disabledSeats: ["A01", "A07"],
      assignment: { code: "BL-208" },
    });
    sessionStorage.removeItem("blue-operator-vehicles-v1");
  });
});
