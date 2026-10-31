import { http, HttpResponse } from "msw";

import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import type { Trip, TripSearch } from "@/features/trips/types/trip";
import { discoveryTrips } from "@/mocks/fixtures/demoTrips";

const SEARCH_FIELD_ERRORS = {
  originId: "Chọn một điểm đi hợp lệ.",
  destinationId: "Chọn điểm đến hợp lệ và khác điểm đi.",
  departureDate: "Chọn ngày đi hợp lệ, không trước hôm nay.",
  passengerCount: "Chọn từ 1 đến 6 hành khách.",
  sort: "Chọn cách sắp xếp hợp lệ.",
} satisfies Record<keyof TripSearch, string>;

const SEARCH_FIELDS = [
  "originId",
  "destinationId",
  "departureDate",
  "passengerCount",
  "sort",
] as const;
type SearchErrors = Partial<Record<keyof TripSearch, string[]>>;

function problemResponse(status: 400 | 503, errors?: SearchErrors): Response {
  const isValidation = status === 400;
  return HttpResponse.json(
    {
      type: "about:blank",
      title: isValidation
        ? "Thông tin tìm kiếm chưa hợp lệ"
        : "Không thể tải chuyến",
      status,
      detail: isValidation
        ? "Kiểm tra điểm đi, điểm đến, ngày đi và số hành khách."
        : "Dịch vụ tìm chuyến tạm thời không khả dụng. Vui lòng thử lại.",
      instance: "/api/v1/trips",
      code: isValidation ? "VALIDATION_ERROR" : "SERVICE_UNAVAILABLE",
      traceId: crypto.randomUUID(),
      ...(errors ? { errors } : {}),
    },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}

const SERVICE_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function getVietnamServiceDate(timestamp: string): string {
  const parts = Object.fromEntries(
    SERVICE_DATE_FORMAT.formatToParts(new Date(timestamp)).map(
      ({ type, value }) => [type, value],
    ),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function queryErrors(
  params: URLSearchParams,
  parsed: ReturnType<typeof tripSearchSchema.safeParse>,
): SearchErrors {
  const errors: SearchErrors = {};
  for (const field of SEARCH_FIELDS) {
    if (
      params.getAll(field).length > 1 ||
      (!parsed.success &&
        parsed.error.issues.some((issue) => issue.path[0] === field))
    )
      errors[field] = [SEARCH_FIELD_ERRORS[field]];
  }
  return errors;
}

function searchTrips(sourceTrips: readonly Trip[], search: TripSearch): Trip[] {
  const items = sourceTrips.filter(
    (trip) =>
      trip.origin.id === search.originId &&
      trip.destination.id === search.destinationId &&
      getVietnamServiceDate(trip.departureTime) === search.departureDate,
  );
  // filter creates a new array; stable sort retains source order when keys tie.
  return items.sort((left, right) =>
    search.sort === "price-asc"
      ? left.fareVnd - right.fareVnd
      : search.sort === "price-desc"
        ? right.fareVnd - left.fareVnd
        : search.sort === "departure"
          ? Date.parse(left.departureTime) - Date.parse(right.departureTime)
          : 0,
  );
}

function handleTripSearch(
  request: Request,
  sourceTrips: readonly Trip[],
): Response {
  const url = new URL(request.url);
  const parsed = tripSearchSchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  const errors = queryErrors(url.searchParams, parsed);
  if (!parsed.success || Object.keys(errors).length)
    return problemResponse(400, errors);
  const items = searchTrips(sourceTrips, parsed.data);
  const canUseScenarios =
    !import.meta.env.PROD &&
    (import.meta.env.DEV || import.meta.env.MODE === "test");
  const scenario = canUseScenarios ? url.searchParams.get("scenario") : null;
  if (scenario === "empty") return HttpResponse.json({ items: [], total: 0 });
  if (scenario === "error") return problemResponse(503);
  return HttpResponse.json({ items, total: items.length });
}

export function createTripHandlers(
  sourceTrips: readonly Trip[] = discoveryTrips,
): ReturnType<typeof http.get>[] {
  return [
    http.get("/api/v1/trips", ({ request }) =>
      handleTripSearch(request, sourceTrips),
    ),
  ];
}

export const tripHandlers = createTripHandlers();
