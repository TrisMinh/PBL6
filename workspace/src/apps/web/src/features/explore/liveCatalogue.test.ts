import { expect, it } from "vitest";
import { catalogueProvinces, catalogueRoutes } from "./liveCatalogue";
import { toTrip } from "../trips/repositories/backendTripRepository";

it("derives routes and directory points from published trip records without duplicating stops", () => {
  const trip = toTrip({
    id: "t",
    organizationId: "o",
    operatorName: "Operator",
    origin: "City A",
    destination: "City B",
    departureAt: "2099-01-01T00:00:00Z",
    arrivalAt: "2099-01-01T01:00:00Z",
    fare: { amount: 123000, currency: "VND" },
    availableSeatCount: 20,
    busType: "CABIN_22",
    amenities: [],
    stops: [
      {
        id: "s",
        name: "Actual station",
        address: "Actual address",
        sequence: 1,
        offsetMinutes: 0,
        pickupAllowed: true,
        dropoffAllowed: false,
      },
    ],
    status: "SCHEDULED",
    sellable: true,
    availabilityAsOf: "2099-01-01T00:00:00Z",
    policyVersion: null,
    rowVersion: 1,
    allowPayLater: false,
  });
  const provinces = catalogueProvinces([trip, { ...trip, id: "second" }]);
  expect(provinces[0]).toMatchObject({
    name: "City A",
    isMock: false,
    pickupCount: 1,
    operatorCount: 1,
  });
  expect(provinces[0].points[0]).toMatchObject({
    name: "Actual station",
    address: "Actual address",
    operatorIds: ["o"],
    latitude: null,
  });
  expect(
    catalogueRoutes([trip, { ...trip, id: "second", fareVnd: 100000 }])[0],
  ).toMatchObject({
    originId: "City A",
    destinationId: "City B",
    minFare: 100000,
    tripCount: 2,
  });
});

it("selects route prices and counts only for the displayed service day", () => {
  const location = (
    name: string,
  ): import("../trips/types/trip").Trip["origin"] => ({
    id: name,
    name,
    displayName: name,
    province: name,
  });
  const trip = {
    id: "t",
    origin: location("A"),
    destination: location("B"),
    departureTime: "2099-01-01T01:00:00Z",
    fareVnd: 100,
  } as import("../trips/types/trip").Trip;
  expect(
    catalogueRoutes(
      [trip, { ...trip, departureTime: "2099-01-02T01:00:00Z", fareVnd: 200 }],
      "2099-01-02",
    )[0],
  ).toMatchObject({ minFare: 200, tripCount: 1, departureDate: "2099-01-02" });
});
