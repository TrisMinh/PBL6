import { describe, it, expect } from "vitest";
import {
  draftFromExistingRoute,
  CREATE_ROUTE_DRAFT_KEY,
} from "./createRouteDraft";
import { routeResponseSchema, operatorRouteSchema } from "./routes.schema";
async function getRoutes(): Promise<
  ReturnType<typeof routeResponseSchema.parse>
> {
  return routeResponseSchema.parse(
    await (
      await fetch(
        new URL("/api/v1/operator/routes-preview", window.location.origin),
      )
    ).json(),
  );
}
describe("Edit Operator route", () => {
  it("prefills all stored stops and operations without sharing mutable data", async () => {
    const route = (await getRoutes()).items[0];
    const draft = draftFromExistingRoute(route);
    expect(draft.id).toBe(route.id);
    expect(draft.stops).toHaveLength(5);
    draft.stops[0].name = "Local unsaved change";
    expect(route.stops[0].name).toBe("Bến xe Miền Đông mới");
    expect(draft.name).toBe("TP.HCM → Đà Lạt");
  });
  it("updates the same route and preserves unrelated routes and create draft", async () => {
    sessionStorage.setItem(CREATE_ROUTE_DRAFT_KEY, "keep-create-draft");
    const before = await getRoutes();
    const input = {
      ...draftFromExistingRoute(before.items[0]),
      name: "Tuyến đã sửa",
      direction: "one-way" as const,
      note: "Ghi chú sửa",
      status: "paused" as const,
      hours: 7.5,
    };
    const response = await fetch(
      new URL(
        "/api/v1/operator/routes-preview/" + input.id,
        window.location.origin,
      ),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );
    expect(response.status).toBe(200);
    expect(operatorRouteSchema.parse(await response.json())).toMatchObject({
      id: input.id,
      name: input.name,
      direction: "one-way",
      note: input.note,
      status: "paused",
    });
    const after = await getRoutes();
    expect(after.items).toHaveLength(before.items.length);
    expect(after.items.slice(1)).toEqual(before.items.slice(1));
    expect(sessionStorage.getItem(CREATE_ROUTE_DRAFT_KEY)).toBe(
      "keep-create-draft",
    );
  });
});
