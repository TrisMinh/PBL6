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
describe("Operator room 21", () => {
  it("matches 10 lower and 11 upper rooms and BL-238 assignment", async () => {
    expect((await list()).find((v) => v.type === 11)).toMatchObject({
      plate: "45B-229.72",
      lowerRooms: 10,
      disabledSeats: ["D07", "T11"],
      assignment: {
        code: "BL-238",
        origin: "TP.HCM",
        destination: "Đà Lạt",
        time: "11:00 – 17:30",
      },
    });
    const codes = vehicleSeatCodes(11);
    expect(codes).toHaveLength(21);
    expect(codes.filter((c) => c.startsWith("D"))).toHaveLength(10);
    expect(codes.filter((c) => c.startsWith("T"))).toHaveLength(11);
  });
  it("validates and persists deck configuration without changing other vehicles", async () => {
    const others = (await list()).filter((v) => v.type !== 11);
    const path = "/45B-229.72/room-configuration";
    expect((await request(path, { lowerRooms: 11 }, "PATCH")).status).toBe(200);
    expect(
      (await request("/45B-229.72/seats/D11", { enabled: false }, "PATCH"))
        .status,
    ).toBe(200);
    expect(
      (await request("/45B-229.72/seats/T11", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect((await request(path, { lowerRooms: 9 }, "PATCH")).status).toBe(400);
    expect(
      (
        await request(
          "/79B-225.40/room-configuration",
          { lowerRooms: 10 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    const saved = vehicleSchema.parse(
      await (await request(path, { lowerRooms: 10 }, "PATCH")).json(),
    );
    expect(saved.lowerRooms).toBe(10);
    expect((await list()).filter((v) => v.type !== 11)).toEqual(others);
  });
  it("migrates legacy room D11 while preserving the rest of the fleet", async () => {
    const previous = await list();
    sessionStorage.setItem(
      "blue-operator-vehicles-v2",
      JSON.stringify(
        previous.map((v) =>
          v.type === 11
            ? { ...v, lowerRooms: undefined, disabledSeats: ["D07", "D11"] }
            : v,
        ),
      ),
    );
    const migrated = await list();
    expect(migrated.find((v) => v.type === 11)?.disabledSeats).toEqual([
      "D07",
      "T11",
    ]);
    expect(migrated.filter((v) => v.type !== 11)).toEqual(
      previous.filter((v) => v.type !== 11),
    );
  });
});
