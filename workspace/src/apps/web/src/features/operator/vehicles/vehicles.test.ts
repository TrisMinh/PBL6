import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  vehicleSchema,
  vehicleSeatCodes,
  VEHICLE_TYPES,
} from "./vehicles.schema";
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
describe("Operator vehicle resource permissions", () => {
  it("returns 15 vehicle configurations and the designed blocked positions", async () => {
    const response = await request();
    const { items } = z
      .object({ items: z.array(vehicleSchema) })
      .parse(await response.json());
    expect(items).toHaveLength(15);
    expect(items[0]).toMatchObject({
      plate: "45B-204.12",
      type: 0,
      disabledSeats: ["D07", "T11"],
    });
    VEHICLE_TYPES.forEach((type, index) => {
      const codes = vehicleSeatCodes(index);
      expect(codes).toHaveLength(type.capacity);
      expect(new Set(codes).size).toBe(type.capacity);
    });
  });
  it("sets permission idempotently, rejects nonexistent positions, and persists in storage", async () => {
    const path = "/45B-204.12/seats/D01";
    expect((await request(path, { enabled: false }, "PATCH")).status).toBe(200);
    const updated = vehicleSchema.parse(
      await (await request(path, { enabled: false }, "PATCH")).json(),
    );
    expect(updated.disabledSeats.filter((c) => c === "D01")).toHaveLength(1);
    expect(sessionStorage.getItem("blue-operator-vehicles-v2")).toContain(
      "D01",
    );
    expect(
      (await request("/45B-204.12/seats/D99", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect((await request(path, { enabled: "false" }, "PATCH")).status).toBe(
      400,
    );
    expect(
      (await request("/missing/seats/D01", { enabled: false }, "PATCH")).status,
    ).toBe(404);
    const enabled = vehicleSchema.parse(
      await (await request(path, { enabled: true }, "PATCH")).json(),
    );
    expect(enabled.disabledSeats).not.toContain("D01");
  });
  it("creates a vehicle with valid layout and rejects duplicate plates", async () => {
    expect((await request("", { plate: "bad", type: 0 }, "POST")).status).toBe(
      400,
    );
    expect(
      (await request("", { plate: "45B-204.12", type: 0 }, "POST")).status,
    ).toBe(409);
    const input = { plate: "59B-999.99", type: 5 };
    const response = await request("", input, "POST");
    expect(response.status).toBe(201);
    const vehicle = vehicleSchema.parse(await response.json());
    expect(vehicle.assignment).toBeNull();
    expect(vehicleSeatCodes(vehicle.type)).toHaveLength(36);
    expect((await request("", input, "POST")).status).toBe(409);
  });
});
