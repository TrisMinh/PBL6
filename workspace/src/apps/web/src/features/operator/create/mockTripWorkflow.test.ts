import { beforeEach, expect, it } from "vitest";
import { server } from "@/mocks/server";
import { operatorWorkflowHandlers } from "@/mocks/handlers/operatorWorkflowHandlers";

beforeEach(() => sessionStorage.clear());
it("creates, edits and publishes a draft using the same mock resource IDs and versions", async () => {
  server.use(...operatorWorkflowHandlers);
  try {
    const get = async (path: string): Promise<Record<string, unknown>[]> =>
      (
        await (
          await fetch(`${window.location.origin}/api/v1/operator/${path}`)
        ).json()
      ).items;
    const routes = await get("routes"),
      buses = await get("buses"),
      drivers = await get("drivers");
    const input = {
      routeId: routes[0].id,
      busId: buses[0].id,
      driverId: drivers[0].id,
      departureAt: "2026-12-20T03:00:00Z",
      arrivalAt: "2026-12-20T10:00:00Z",
      fare: { amount: 450000, currency: "VND" },
      expectedVersion: 0,
      policyVersion: "cancel-mvp-v1",
    };
    const post = (
      path: string,
      body: unknown,
      method = "POST",
    ): Promise<Response> =>
      fetch(`${window.location.origin}/api/v1/operator/trips${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    const created = await (await post("", input)).json();
    expect(created).toMatchObject({
      status: "DRAFT",
      routeId: routes[0].id,
      rowVersion: 0,
    });
    const edited = await (
      await post(
        `/${created.id}`,
        { ...input, fare: { amount: 500000, currency: "VND" } },
        "PATCH",
      )
    ).json();
    expect(edited.rowVersion).toBe(1);
    expect(
      (await post(`/${created.id}/publish`, { expectedVersion: 0 })).status,
    ).toBe(409);
    expect(
      (await post(`/${created.id}/publish`, { expectedVersion: 1 })).status,
    ).toBe(200);
    const result = (await get("trips")).find((t) => t.id === created.id);
    expect(result).toMatchObject({
      status: "SCHEDULED",
      sellable: true,
      rowVersion: 2,
    });
    const overlapping = await (await post("", input)).json();
    expect((await post(`/${overlapping.id}/publish`, { expectedVersion: 0 })).status).toBe(409);
  } finally {
    server.resetHandlers();
  }
});
