import { describe, it, expect } from "vitest";
import {
  routeResponseSchema,
  operatorRouteSchema,
  routeInputSchema,
} from "./routes.schema";
async function request(
  path = "",
  body?: unknown,
  method = "GET",
): Promise<Response> {
  return fetch(
    new URL(`/api/v1/operator/routes-preview${path}`, window.location.origin),
    {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    },
  );
}
describe("Operator resource routes", () => {
  it("returns the six Figma routes with ordered stops", async () => {
    const result = routeResponseSchema.parse(await (await request()).json());
    expect(result.items).toHaveLength(6);
    const first = result.items[0];
    expect(first.id).toBe("RT-HCM-DLI");
    expect(first.stops.map((stop) => stop.km)).toEqual([0, 18, 85, 190, 310]);
  });
  it("validates distances and distinct endpoints", async () => {
    const first = routeResponseSchema.parse(await (await request()).json())
      .items[0];
    const { updatedAt, ...input } = first;
    void updatedAt;
    expect(
      routeInputSchema.safeParse({ ...input, destination: input.origin })
        .success,
    ).toBe(false);
    expect(
      (await request("/" + input.id, { ...input, distance: 100 }, "PUT"))
        .status,
    ).toBe(400);
  });
  it("creates once, rejects duplicates, persists updates and sorts new stops", async () => {
    const first = routeResponseSchema.parse(await (await request()).json())
      .items[0];
    const { updatedAt, ...base } = first;
    void updatedAt;
    const input = { ...base, id: "RT-TEST-API" };
    const created = await request("", input, "POST");
    expect(created.status).toBe(201);
    expect((await request("", input, "POST")).status).toBe(409);
    const update = {
      ...input,
      status: "paused",
      stops: [
        ...input.stops,
        {
          id: "new-stop",
          name: "Điểm thử",
          address: "Đồng Nai",
          kind: "both",
          km: 40,
        },
      ],
    };
    expect((await request("/" + input.id, update, "PUT")).status).toBe(200);
    const saved = operatorRouteSchema.parse(
      await (await request("/" + input.id, update, "PUT")).json(),
    );
    expect(saved.status).toBe("paused");
    expect(saved.stops[2].km).toBe(40);
    expect(
      routeResponseSchema
        .parse(await (await request()).json())
        .items.find((route) => route.id === input.id)?.status,
    ).toBe("paused");
    expect((await request("/RT-MISSING", input, "PUT")).status).toBe(404);
  });
});
