import { describe, it, expect } from "vitest";
import {
  stopCatalogueSchema,
  cataloguePlaceToStop,
} from "./stopCatalogue.schema";
import { CREATE_ROUTE_SAMPLE } from "./createRouteDraft";
async function request(params: Record<string, string>): Promise<Response> {
  const url = new URL(
    "/api/v1/operator/stop-catalogue",
    window.location.origin,
  );
  url.search = new URLSearchParams(params).toString();
  return fetch(url);
}
describe("Operator stop catalogue", () => {
  it("returns route-specific locations with forward and reverse distances", async () => {
    const forward = stopCatalogueSchema.parse(
      await (
        await request({
          origin: "TP.HCM",
          destination: "Đà Lạt",
          distance: "310",
        })
      ).json(),
    );
    const reverse = stopCatalogueSchema.parse(
      await (
        await request({
          origin: "Đà Lạt",
          destination: "TP.HCM",
          distance: "310",
        })
      ).json(),
    );
    expect(forward.items.find((place) => place.id === "suoi-tien")?.km).toBe(
      12,
    );
    expect(reverse.items.find((place) => place.id === "suoi-tien")?.km).toBe(
      298,
    );
    expect(forward.items[0]).toMatchObject({
      province: "TP.HCM",
      district: "TP. Thủ Đức",
      name: "Bến xe Miền Đông mới",
    });
    expect(
      (
        await request({
          origin: "TP.HCM",
          destination: "Đà Lạt",
          distance: "0",
        })
      ).status,
    ).toBe(400);
  });
  it("prevents duplicate legacy and catalogue stops and preserves service type", async () => {
    const { items } = stopCatalogueSchema.parse(
      await (
        await request({
          origin: "TP.HCM",
          destination: "Đà Lạt",
          distance: "310",
        })
      ).json(),
    );
    const first = items.find((place) => place.id === "mien-dong");
    if (!first) throw Error("Missing first fixture");
    expect(() =>
      cataloguePlaceToStop(first, "both", CREATE_ROUTE_SAMPLE.stops, 310),
    ).toThrow("đã có");
    const place = items.find((place) => place.id === "suoi-tien");
    if (!place) throw Error("Missing stop fixture");
    const added = cataloguePlaceToStop(
      place,
      "dropoff",
      CREATE_ROUTE_SAMPLE.stops,
      310,
    );
    expect(added).toMatchObject({
      id: "place:suoi-tien",
      kind: "dropoff",
      km: 12,
    });
    expect(() => cataloguePlaceToStop(place, "pickup", [added], 310)).toThrow(
      "đã có",
    );
    expect(() =>
      cataloguePlaceToStop({ ...place, km: 500 }, "both", [], 310),
    ).toThrow("chiều dài");
  });
  it("provides explicit sample endpoints for other routes", async () => {
    const result = stopCatalogueSchema.parse(
      await (
        await request({
          origin: "Huế",
          destination: "Đà Nẵng",
          distance: "100",
        })
      ).json(),
    );
    expect(result.items.map((place) => place.km)).toEqual([0, 100]);
    expect(result.items.every((place) => place.name.includes("mẫu"))).toBe(
      true,
    );
  });
});
