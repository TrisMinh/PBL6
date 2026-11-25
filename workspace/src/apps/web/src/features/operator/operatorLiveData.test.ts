import { beforeEach, expect, it, vi } from "vitest";
import {
  vehicleCapacity,
  vehicleInputSchema,
} from "./vehicles/vehicles.schema";
import { driverInputSchema } from "./drivers/drivers.schema";
import { routeInputSchema } from "./resources/routes.schema";
import {
  getOperatorVehicles,
  setVehicleSeatPermission,
} from "./vehicles/vehiclesRepository";
import { getOperatorRoutes } from "./resources/routesRepository";
import { getDriverResourceRows, getDrivers } from "./drivers/driversRepository";
import { getOperatorBookings } from "./bookings/bookingsRepository";
import { bookingFiltersSchema } from "./bookings/bookings.schema";
import { operatorDefaultRange } from "./operatorDates";
import { paginationWindow } from "./components/paginationWindow";
import { cancelTrip } from "./detail/detailRepository";
import { adaptSchedule } from "./schedule/scheduleRepository";
import { driverLabel } from "./tripWorkflow";

const api = vi.hoisted(() => {
  vi.resetModules();
  return {
    rows: vi.fn(),
    metadata: vi.fn(),
    request: vi.fn(),
    saveMetadata: vi.fn(),
  };
});
vi.mock("@/shared/api/config", () => ({ isMockApi: false }));
vi.mock("./liveOriginalApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./liveOriginalApi")>()),
  ...api,
}));
const seats = [
  { code: "A01", deck: 1, row: 1, column: 1, type: "STANDARD", enabled: true },
  { code: "A02", deck: 1, row: 1, column: 3, type: "STANDARD", enabled: false },
];
const bus = {
  id: "bus",
  plateNumber: "SEED-01",
  type: "STANDARD",
  seats,
  expectedVersion: 9,
};
beforeEach(() => {
  vi.clearAllMocks();
  api.rows.mockResolvedValue([]);
  api.metadata.mockResolvedValue({});
});

it("reads legacy fleet plates and actual capacity without weakening new-vehicle validation", async () => {
  api.rows.mockResolvedValue([bus]);
  const [vehicle] = await getOperatorVehicles();
  expect(vehicle.plate).toBe("SEED-01");
  expect(vehicle.actualSeats).toEqual(seats);
  expect(vehicleCapacity(vehicle)).toBe(2);
  expect(vehicle.disabledSeats).toEqual(["A02"]);
  expect(
    vehicleInputSchema.safeParse({ plate: "SEED-01", type: 2 }).success,
  ).toBe(false);
});

it("a permission change preserves every actual seat code and coordinate instead of rebuilding a template", async () => {
  api.rows.mockResolvedValue([bus]);
  api.request.mockImplementation(async (_path, _method, body) => ({
    ...bus,
    seats: seats.map((seat) =>
      seat.code === "A02" ? { ...seat, enabled: body.enabled } : seat,
    ),
    expectedVersion: 10,
  }));
  const saved = await setVehicleSeatPermission("bus", "A02", true);
  expect(api.request).toHaveBeenCalledWith(
    "/api/v1/operator/buses/bus/seats/A02/permission",
    "PATCH",
    { enabled: true, expectedVersion: 9 },
  );
  expect(saved.actualSeats).toEqual([seats[0], { ...seats[1], enabled: true }]);
  expect(vehicleCapacity(saved)).toBe(2);
  expect(saved.disabledSeats).toEqual([]);
  expect(api.saveMetadata).not.toHaveBeenCalled();
});

it("reads a route with missing historical distance while keeping create validation strict", async () => {
  api.rows.mockResolvedValue([
    {
      id: "route",
      name: "A – B",
      origin: "A",
      destination: "B",
      distanceKm: null,
      durationMinutes: 120,
      status: "ACTIVE",
      stops: [
        {
          id: "a",
          name: "A",
          address: "",
          offsetMinutes: 0,
          pickupAllowed: true,
          dropoffAllowed: false,
        },
        {
          id: "b",
          name: "B",
          address: "",
          offsetMinutes: 120,
          pickupAllowed: false,
          dropoffAllowed: true,
        },
      ],
    },
  ]);
  const [route] = await getOperatorRoutes();
  expect(route.distance).toBe(0);
  expect(route.stops).toHaveLength(2);
  const input = routeInputSchema.safeParse({
    id: route.id,
    origin: route.origin,
    destination: route.destination,
    region: route.region,
    distance: route.distance,
    hours: route.hours,
    status: route.status,
    stops: route.stops.map((s) => ({ ...s, address: "Address" })),
  });
  expect(input.success).toBe(false);
  if (!input.success)
    expect(
      input.error.issues.some((issue) => issue.path[0] === "distance"),
    ).toBe(true);
});

it("reads backend driver records with international phone and legacy license formats", async () => {
  api.rows.mockImplementation(async (path) =>
    path.endsWith("/drivers")
      ? [
          {
            id: "driver",
            userId: "user",
            licenseNumber: "SEED-LIC-001",
            licenseExpiresOn: "2028-12-31",
            status: "ACTIVE",
          },
        ]
      : [
          {
            userId: "user",
            fullName: "Driver Name",
            phone: "+84901234567",
            email: "driver@example.test",
            createdAt: "2026-01-01T00:00:00Z",
          },
        ],
  );
  const [driver] = await getDrivers();
  expect(driver.name).toBe("Driver Name");
  expect(driver.phone).toBe("+84901234567");
  expect(driverInputSchema.safeParse(driver).success).toBe(false);
});

it("uses profile and account names in trip assignments while keeping the driver IDs and licences", async () => {
  const first = {
    id: "driver-1",
    userId: "user-1",
    licenseNumber: "123456789012",
  };
  const second = {
    id: "driver-2",
    userId: "user-2",
    licenseNumber: "987654321098",
  };
  api.rows.mockImplementation(async (path) =>
    path.endsWith("/drivers")
      ? [first, second]
      : [
          { userId: "user-2", fullName: "Trần Văn Nam" },
          { userId: "user-1", fullName: "Tên lúc tạo tài khoản" },
        ],
  );
  api.metadata.mockResolvedValue({
    "driver-1": { name: "  Nguyễn Kim My  " },
    "driver-2": { name: " " },
  });

  const [namedFromProfile, namedFromAccount] = await getDriverResourceRows();
  expect(namedFromProfile).toMatchObject({
    ...first,
    fullName: "Nguyễn Kim My",
  });
  expect(namedFromAccount).toMatchObject({
    ...second,
    fullName: "Trần Văn Nam",
  });
  expect(driverLabel({ fullName: namedFromProfile.fullName })).toBe(
    "Nguyễn Kim My",
  );
  expect(driverLabel({})).toBe("Chưa có tên tài xế");
});

it("paid bookings are confirmed and paid, and the unbounded range includes historical records", async () => {
  api.request.mockResolvedValue({
    totalElements: 42,
    items: [
      {
        id: "booking",
        code: "BK",
        tripId: "trip",
        status: "PAID",
        paymentChannel: "PREPAID",
        total: 100000,
        createdAt: "2025-01-01T00:00:00Z",
        contact: { fullName: "Passenger", phone: "0901234567" },
        items: [{ seatId: "seat" }],
        seatCodes: ["A01"],
      },
    ],
  });
  api.rows.mockResolvedValue([
    {
      id: "trip",
      departureAt: "2026-11-17T01:00:00Z",
      origin: "A",
      destination: "B",
    },
  ]);
  const result = await getOperatorBookings(
    bookingFiltersSchema.parse({
      from: "",
      to: "",
      status: "confirmed",
      payment: "paid",
    }),
  );
  expect(result.total).toBe(42);
  expect(api.request).toHaveBeenCalledExactlyOnceWith(
    "/api/v1/operator/bookings?page=0&size=10&operatorStatus=confirmed&operatorPayment=paid",
    "GET",
    undefined,
    undefined,
  );
  expect(api.rows).toHaveBeenCalledExactlyOnceWith(
    "/api/v1/operator/trips?tripId=trip",
    undefined,
  );
  expect(result.items[0]).toMatchObject({
    status: "confirmed",
    payment: "paid",
    seat: "A01",
    departureTime: "08:00",
  });
});

it("live defaults do not hide bookings or settlements behind fixed demo dates", () => {
  expect(operatorDefaultRange("bookings")).toEqual({ from: "", to: "" });
  expect(operatorDefaultRange("settlements")).toEqual({ from: "", to: "" });
});

it("pagination stays bounded for large real collections and keeps first/current/last pages", () => {
  const pages = paginationWindow(50, 100);
  expect(pages).toEqual([1, "start-gap", 48, 49, 50, 51, 52, "end-gap", 100]);
  expect(paginationWindow(1, 1)).toEqual([1]);
});

it("cancellation sends the shown version and reason to the real operator endpoint", async () => {
  api.request.mockResolvedValue({ operationId: "operation" });
  await cancelTrip("trip", 7, "Vehicle unavailable");
  expect(api.request).toHaveBeenCalledWith(
    "/api/v1/operator/trips/trip/cancel",
    "POST",
    { expectedVersion: 7, reason: "Vehicle unavailable" },
  );
});

it("historical completed and cancelled trips retain their actual status", () => {
  const trip = {
    id: "trip",
    origin: "A",
    destination: "B",
    departureAt: "2026-11-17T01:00:00Z",
    arrivalAt: "2026-11-17T03:00:00Z",
    busId: "bus",
    availableSeatCount: 1,
  };
  expect(
    adaptSchedule({ ...trip, status: "CANCELLED" }, [bus], []).status,
  ).toBe("cancelled");
  expect(
    adaptSchedule({ ...trip, status: "COMPLETED" }, [bus], []).status,
  ).toBe("completed");
});
