import { describe, it, expect } from "vitest";
import {
  CREATE_ROUTE_SAMPLE,
  CREATE_ROUTE_DRAFT_KEY,
  loadCreateRouteDraft,
  saveCreateRouteDraft,
} from "./createRouteDraft";
import { routeInputSchema, operatorRouteSchema } from "./routes.schema";
describe("Create Operator route", () => {
  it("preserves incomplete local drafts and recovers corrupt storage", () => {
    const incomplete = { ...CREATE_ROUTE_SAMPLE, id: "", stops: [] };
    expect(saveCreateRouteDraft(incomplete)).toBe(true);
    expect(loadCreateRouteDraft()).toEqual(incomplete);
    expect(routeInputSchema.safeParse(incomplete).success).toBe(false);
    sessionStorage.setItem(CREATE_ROUTE_DRAFT_KEY, "invalid");
    expect(loadCreateRouteDraft().stops).toHaveLength(4);
    sessionStorage.removeItem(CREATE_ROUTE_DRAFT_KEY);
  });
  it("stores route name, direction and internal note through the API", async () => {
    const input = {
      ...CREATE_ROUTE_SAMPLE,
      id: "RT-TEST-CREATE",
      name: "Tuyến API",
      direction: "one-way",
      note: "Ghi chú kiểm thử",
    };
    const url = new URL(
      "/api/v1/operator/routes-preview",
      window.location.origin,
    );
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(response.status).toBe(201);
    const saved = operatorRouteSchema.parse(await response.json());
    expect(saved).toMatchObject({
      name: input.name,
      direction: input.direction,
      note: input.note,
    });
    expect(saved.stops.map((stop) => stop.km)).toEqual([0, 18, 85, 310]);
    const duplicate = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    expect(duplicate.status).toBe(409);
  });
});
