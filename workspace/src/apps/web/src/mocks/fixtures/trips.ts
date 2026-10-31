import type { Trip, TripAmenity } from "@/features/trips/types/trip";
import { locations } from "@/mocks/fixtures/locations";
import { operators } from "@/mocks/fixtures/operators";

const [hoChiMinh, daNang, daLat, haNoi] = locations;
const [blueExpress, saoMai, duongViet, hanhTrinhXanh, caoNguyen, doiXanh] =
  operators;

interface TripPresentation {
  operatorName?: string;
  vehicleLabel?: string;
  vehicleType?: Trip["vehicleType"];
  departureTime?: string;
  arrivalTime?: string;
  fareVnd?: number;
  availableSeatCount?: number;
  originStopName?: string;
  destinationStopName?: string;
  amenities?: readonly TripAmenity[];
}

function canonicalTrip(
  id: string,
  operator: (typeof operators)[number],
  departureTime: string,
  arrivalTime: string,
  fareVnd: number,
  availableSeatCount: number,
  vehicleType: Trip["vehicleType"],
  presentation: TripPresentation = {},
): Readonly<Trip> {
  const canonicalDepartureTime = presentation.departureTime ?? departureTime;
  const canonicalArrivalTime = presentation.arrivalTime ?? arrivalTime;
  const canonicalFareVnd = presentation.fareVnd ?? fareVnd;
  const canonicalAvailableSeatCount =
    presentation.availableSeatCount ?? availableSeatCount;
  const canonicalVehicleType = presentation.vehicleType ?? vehicleType;
  return Object.freeze({
    id,
    origin: hoChiMinh,
    destination: daLat,
    operator,
    displayOperatorName: presentation.operatorName ?? operator.name,
    departureTime: canonicalDepartureTime,
    arrivalTime: canonicalArrivalTime,
    fareVnd: canonicalFareVnd,
    availableSeatCount: canonicalAvailableSeatCount,
    vehicleType: canonicalVehicleType,
    vehicleLabel:
      presentation.vehicleLabel ??
      (canonicalVehicleType === "sleeper-34"
        ? "Limousine giường 34"
        : "Giường phòng 21"),
    originStopName: presentation.originStopName ?? hoChiMinh.name,
    destinationStopName: presentation.destinationStopName ?? daLat.name,
    amenities: Object.freeze(
      presentation.amenities ??
        (["wifi", "charging"] satisfies readonly TripAmenity[]),
    ),
  });
}

const canonicalResults = [
  canonicalTrip(
    "trip-hcm-dalat-early",
    blueExpress,
    "2098-12-31T23:30:00Z",
    "2099-01-01T05:30:00Z",
    280_000,
    18,
    "sleeper-34",
    {
      operatorName: "BLUE Expres.",
      vehicleLabel: "Limousine 11 chỗ",
      vehicleType: "cabin-22",
      departureTime: "2099-01-01T00:00:00Z",
      arrivalTime: "2099-01-01T06:30:00Z",
      fareVnd: 320_000,
      availableSeatCount: 6,
      originStopName: "Miền Đông mới",
      destinationStopName: "Bến xe Đà Lạt",
      amenities: ["wifi", "charging"],
    },
  ),
  canonicalTrip(
    "trip-hcm-dalat-cabin",
    saoMai,
    "2099-01-01T02:00:00Z",
    "2099-01-01T08:00:00Z",
    420_000,
    9,
    "cabin-22",
    {
      operatorName: "An Lạc",
      vehicleLabel: "Giường nằm 40 chỗ",
      vehicleType: "sleeper-34",
      departureTime: "2099-01-01T01:00:00Z",
      arrivalTime: "2099-01-01T07:15:00Z",
      fareVnd: 280_000,
      availableSeatCount: 12,
      originStopName: "Miền Đông mới",
      destinationStopName: "Bến xe Đà Lạt",
      amenities: ["wifi", "charging", "restroom"],
    },
  ),
  canonicalTrip(
    "trip-hcm-dalat-mid-morning",
    duongViet,
    "2099-01-01T02:30:00Z",
    "2099-01-01T08:45:00Z",
    390_000,
    4,
    "cabin-22",
    {
      operatorName: "Thiên Việt",
      vehicleLabel: "Cabin 24 phòng",
      originStopName: "Bến xe Q.5",
      destinationStopName: "Trung tâm Đà Lạt",
      amenities: ["wifi", "charging", "doorPickup"],
    },
  ),
  canonicalTrip(
    "trip-hcm-dalat-late-morning",
    hanhTrinhXanh,
    "2099-01-01T04:00:00Z",
    "2099-01-01T10:20:00Z",
    330_000,
    9,
    "cabin-22",
    {
      operatorName: "Minh Châu",
      vehicleLabel: "Limousine 24 chỗ",
      originStopName: "Miền Đông mới",
      destinationStopName: "Bến xe Đà Lạt",
      amenities: ["wifi"],
    },
  ),
  canonicalTrip(
    "trip-hcm-dalat-afternoon",
    caoNguyen,
    "2099-01-01T06:30:00Z",
    "2099-01-01T13:00:00Z",
    275_000,
    15,
    "sleeper-34",
    {
      operatorName: "Cao Nguyên",
      vehicleLabel: "Limousine giường 34",
      originStopName: "Bến xe An Sương",
      destinationStopName: "Bến xe Đà Lạt",
      amenities: ["charging"],
    },
  ),
  canonicalTrip(
    "trip-hcm-dalat-night",
    doiXanh,
    "2099-01-01T15:00:00Z",
    "2099-01-01T21:30:00Z",
    350_000,
    7,
    "cabin-22",
    {
      operatorName: "Đồi Xanh",
      vehicleLabel: "Giường phòng 21",
      originStopName: "Miền Đông mới",
      destinationStopName: "Trung tâm Đà Lạt",
      amenities: [],
    },
  ),
  canonicalTrip(
    "trip-hcm-dalat-sold-out",
    duongViet,
    "2099-01-01T06:00:00Z",
    "2099-01-01T12:30:00Z",
    260_000,
    0,
    "sleeper-34",
  ),
  canonicalTrip(
    "trip-hcm-dalat-evening",
    blueExpress,
    "2099-01-01T15:00:00Z",
    "2099-01-01T21:00:00Z",
    480_000,
    4,
    "cabin-22",
  ),
  ...Array.from({ length: 16 }, (_, index) => {
    const departure = new Date(Date.UTC(2099, 0, 1, 15, 10 + index * 5));
    const arrival = new Date(
      departure.getTime() + (360 + (index % 4) * 15) * 60_000,
    );
    return canonicalTrip(
      `trip-hcm-dalat-page-${String(index + 9).padStart(2, "0")}`,
      operators[index % operators.length],
      departure.toISOString(),
      arrival.toISOString(),
      250_000 + (index % 8) * 25_000,
      5 + (index % 15),
      index % 2 === 0 ? "sleeper-34" : "cabin-22",
      {
        amenities: [
          ...(index % 2 === 0 ? (["wifi"] as const) : []),
          ...(index % 3 === 0 ? (["charging"] as const) : []),
          ...(index % 4 === 0 ? (["restroom"] as const) : []),
          ...(index % 5 === 0 ? (["doorPickup"] as const) : []),
        ],
      },
    );
  }),
] satisfies readonly Readonly<Trip>[];

// Fixed Vietnam service days: 2099-01-01/02. UTC date prefixes are not service dates.
export const trips = Object.freeze([
  ...canonicalResults,
  canonicalTrip(
    "trip-hcm-dalat-next-day",
    saoMai,
    "2099-01-01T23:00:00Z",
    "2099-01-02T05:00:00Z",
    300_000,
    20,
    "sleeper-34",
  ),
  Object.freeze({
    id: "trip-danang-hanoi-day",
    origin: daNang,
    destination: haNoi,
    operator: duongViet,
    displayOperatorName: duongViet.name,
    departureTime: "2099-01-01T01:00:00Z",
    arrivalTime: "2099-01-01T15:00:00Z",
    fareVnd: 650_000,
    availableSeatCount: 12,
    vehicleType: "sleeper-34",
    vehicleLabel: "Limousine giường 34",
    originStopName: daNang.name,
    destinationStopName: haNoi.name,
    amenities: Object.freeze(["wifi", "charging"] as const),
  }),
]) satisfies readonly Readonly<Trip>[];
