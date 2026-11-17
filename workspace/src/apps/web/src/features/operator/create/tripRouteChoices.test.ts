import { expect, it } from "vitest";
import type { Route } from "../tripWorkflow";
import {
  matchingRoutes,
  routeEndpoint,
  routeProvince,
  selectionForRoute,
  stopChoiceKey,
} from "./tripRouteChoices";

const route: Route = {
  id: "route-a",
  name: "Mỹ Đình – Đà Lạt",
  origin: "Hà Nội",
  destination: "Đà Lạt",
  status: "ACTIVE",
  durationMinutes: 1080,
  stops: [
    {
      id: "p1",
      name: "Bến xe Mỹ Đình",
      address: "Hà Nội",
      sequence: 0,
      offsetMinutes: 0,
      pickupAllowed: true,
      dropoffAllowed: false,
    },
    {
      id: "middle",
      name: "Điểm dừng giữa tuyến",
      sequence: 1,
      offsetMinutes: 100,
      pickupAllowed: true,
      dropoffAllowed: true,
    },
    {
      id: "d1",
      name: "Bến xe Đà Lạt",
      address: "Đà Lạt",
      sequence: 2,
      offsetMinutes: 1080,
      pickupAllowed: false,
      dropoffAllowed: true,
    },
  ],
};
it("shows province names separately from stations and local city endpoints", () => {
  expect(routeProvince("Đà Lạt")).toBe("Lâm Đồng");
  expect(routeProvince("TP.HCM")).toBe("TP. Hồ Chí Minh");
  expect(routeProvince("Seed Origin Station")).toBe("");
  expect(selectionForRoute(route).destination).toBe("Lâm Đồng");
});
it("uses the route's departure/arrival endpoints rather than an intermediate stop", () => {
  expect(routeEndpoint(route, true)?.id).toBe("p1");
  expect(routeEndpoint(route, false)?.id).toBe("d1");
  expect(routeEndpoint({ ...route, stops: [] }, true)).toBeUndefined();
});
it("resolves the saved route from both selected provinces and pickup/dropoff points", () => {
  const other = {
    ...route,
    id: "route-b",
    stops: route.stops.map((stop) =>
      stop.id === "p1" ? { ...stop, id: "p2", name: "Bến xe Giáp Bát" } : stop,
    ),
  };
  const choice = selectionForRoute(other);
  expect(matchingRoutes([route, other], choice).map((item) => item.id)).toEqual(
    ["route-b"],
  );
  expect(
    matchingRoutes([route, other], { ...choice, pickup: "", dropoff: "" }),
  ).toEqual([]);
  expect(
    matchingRoutes([route, other], { ...choice, destination: "Đà Nẵng" }),
  ).toEqual([]);
});
it("deduplicates the same physical stop even when routes use separate stop ids", () => {
  expect(stopChoiceKey(route.stops[0])).toBe(
    stopChoiceKey({ ...route.stops[0], id: "another-id" }),
  );
  expect(stopChoiceKey(route.stops[0])).not.toBe(
    stopChoiceKey({ ...route.stops[0], address: "Địa chỉ khác" }),
  );
});
