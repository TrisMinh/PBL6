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
describe("Limousine 10 Operator vehicle", () => {
  it("matches the 10-seat fixture and BL-230 assignment", async () => {
    const vehicle = (await list()).find((v) => v.type === 3);
    expect(vehicle).toMatchObject({
      plate: "51B-230.10",
      disabledSeats: ["A07"],
      assignment: {
        code: "BL-230",
        origin: "TP.HCM",
        destination: "Nha Trang",
        time: "13:30 – 20:00",
      },
    });
    expect(vehicleSeatCodes(3)).toEqual(
      Array.from(
        { length: 10 },
        (_, index) => `A${String(index + 1).padStart(2, "0")}`,
      ),
    );
  });
  it("persists permission changes and rejects positions outside the fixed layout", async () => {
    const otherVehicles = (await list()).filter((v) => v.type !== 3);
    const path = "/51B-230.10/seats/A07";
    const updated = vehicleSchema.parse(
      await (await request(path, { enabled: true }, "PATCH")).json(),
    );
    expect(updated.disabledSeats).not.toContain("A07");
    expect(
      (await request("/51B-230.10/seats/A11", { enabled: false }, "PATCH"))
        .status,
    ).toBe(400);
    expect(
      (
        await request(
          "/51B-230.10/rear-configuration",
          { rearSeats: 4 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect((await list()).filter((v) => v.type !== 3)).toEqual(otherVehicles);
    expect(
      (await list()).find((v) => v.type === 3)?.disabledSeats,
    ).not.toContain("A07");
  });
});
