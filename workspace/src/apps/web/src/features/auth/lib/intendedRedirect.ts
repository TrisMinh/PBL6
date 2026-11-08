import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import { ROUTES } from "@/shared/config/routes";
import { isMockApi } from "@/shared/api/config";

function validTripQuery(url: URL): boolean {
  const keys = [
    "originId",
    "destinationId",
    "departureDate",
    "passengerCount",
    "sort",
    "vehicleType",
  ];
  return (
    ![...url.searchParams.keys()].some(
      (key) => !keys.includes(key) || url.searchParams.getAll(key).length !== 1,
    ) &&
    tripSearchSchema.safeParse(Object.fromEntries(url.searchParams)).success
  );
}
export function safeIntendedRedirect(
  input: unknown,
  role: "customer" | "admin",
): string {
  const fallback =
    role === "admin"
      ? isMockApi
        ? ROUTES.adminOrganizations
        : ROUTES.adminStaff
      : ROUTES.accountTickets;
  if (
    typeof input !== "string" ||
    input.length > 2048 ||
    !input.startsWith("/") ||
    /[\\#\s%]/.test(input) ||
    input.startsWith("//")
  )
    return fallback;
  const url = new URL(input, "https://blue.invalid");
  if (url.pathname === ROUTES.trips)
    return validTripQuery(url) ? input : fallback;
  if (/^\/trips\/[A-Za-z0-9_-]{1,128}\/seats$/.test(url.pathname)) {
    const query = [...url.searchParams];
    return query.length <= 1 &&
      query.every(
        ([key, value]) => key === "passengerCount" && /^[1-6]$/.test(value),
      )
      ? input
      : fallback;
  }
  if (url.search) return fallback;
  const publicPath =
    [ROUTES.home, ROUTES.accountTickets, ROUTES.ticketLookup].some(
      (path) => path === input,
    ) ||
    /^\/tickets\/BLUE-[A-Z0-9-]{1,128}$/.test(input) ||
    /^\/booking\/[A-Za-z0-9_-]{1,128}\/(?:seats|passengers|review)$/.test(
      input,
    );
  const adminPath =
    role === "admin" &&
    /^\/admin\/(?:organizations|staff|bookings|payments|refunds)(?:\/[A-Za-z0-9_-]{1,128})?$/.test(
      input,
    );
  return publicPath || adminPath ? input : fallback;
}
