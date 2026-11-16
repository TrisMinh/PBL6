import {
  type RouteConfig,
  type RouteConfigEntry,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

import { ROUTES } from "../shared/config/routes";

const allRoutes = [
  layout("./routes/layouts/operator.tsx", [
    route(
      "/operator/refund-requests/:bookingCode",
      "./routes/operator/refund-tracking.tsx",
    ),
    route("/operator/refund-requests", "./routes/operator/refund-requests.tsx"),
    route(
      "/operator/drivers/:driverId/edit",
      "./routes/operator/edit-driver.tsx",
    ),
    route("/operator/drivers/new", "./routes/operator/new-driver.tsx"),
    route("/operator/drivers", "./routes/operator/drivers.tsx"),
    route("/operator/reports", "./routes/operator/reports.tsx"),
    route("/operator/vehicles", "./routes/operator/vehicles.tsx"),
    route(
      "/operator/routes/:routeId/edit",
      "./routes/operator/edit-resource-route.tsx",
    ),
    route(
      "/operator/routes/new",
      "./routes/operator/create-resource-route.tsx",
    ),
    route("/operator/routes", "./routes/operator/resources-routes.tsx"),
    route(
      "/operator/bookings/trips/:tripId/passengers",
      "./routes/operator/passenger-manifest.tsx",
    ),
    route(
      "/operator/bookings/trips",
      "./routes/operator/trip-passenger-lists.tsx",
    ),
    route("/operator/settlements", "./routes/operator/settlements.tsx"),
    route("/operator/organization", "./routes/operator/organization.tsx"),
    route("/operator/bookings", "./routes/operator/bookings.tsx"),
    route("/operator/trips/draft/edit", "./routes/operator/edit-draft.tsx"),
    route("/operator/trips/review", "./routes/operator/trip-review.tsx"),
    route("/operator/trips/:tripId", "./routes/operator/trip-detail.tsx"),
    route("/operator/trips/new", "./routes/operator/new-trip.tsx"),
    route("/operator/trips", "./routes/operator/trips.tsx"),
  ]),
  layout("./routes/layouts/customer.tsx", [
    index("./routes/home.tsx"),
    route(ROUTES.trips, "./routes/trips.tsx"),
    route(ROUTES.explore, "./routes/explore/index.tsx"),
    route(`${ROUTES.explore}/:provinceSlug`, "./routes/explore/detail.tsx"),
    route("/terms", "./routes/information.tsx", { id: "information-terms" }),
    route("/privacy", "./routes/information.tsx", {
      id: "information-privacy",
    }),
    route("/support", "./routes/information.tsx", {
      id: "information-support",
    }),
    route("/contact", "./routes/information.tsx", {
      id: "information-contact",
    }),
    route("/about", "./routes/information.tsx", { id: "information-about" }),
    route("/offers", "./routes/information.tsx", { id: "information-offers" }),
    route(ROUTES.partners, "./routes/partners.tsx"),
    route(ROUTES.login, "./routes/auth/login.tsx"),
    route(ROUTES.register, "./routes/auth/register.tsx"),
    route("/verify-email", "./routes/auth/verify-email.tsx"),
    route("/reset-password", "./routes/auth/reset-password.tsx"),
    route(ROUTES.forgotPassword, "./routes/auth/forgot-password.tsx"),
    route(ROUTES.ticketLookup, "./routes/tickets/lookup.tsx"),
    layout("./routes/guards/customer-session.tsx", [
      route(ROUTES.accountTickets, "./routes/account/tickets.tsx"),
      route(ROUTES.accountProfile, "./routes/account/profile.tsx"),
      route(ROUTES.accountSettings, "./routes/account/settings.tsx"),
      route("/trips/:tripId/seats", "./routes/booking/trip-seats.tsx"),
    ]),
    route("/tickets/:ticketCode", "./routes/tickets/detail.tsx"),
    route("/bookings/:bookingCode/cancel", "./routes/bookings/cancel.tsx"),
    route("/refunds/:refundId", "./routes/bookings/refund.tsx"),
    route("/payment/sepay/return", "./routes/payment/sepay-return.tsx"),
    route("/payment/vnpay/return", "./routes/payment/vnpay-return.tsx"),
    route("*", "./routes/not-found.tsx"),
    layout("./routes/guards/booking-session.tsx", [
      route("/booking/:sessionId/seats", "./routes/booking/seats.tsx"),
      route(
        "/booking/:sessionId/passengers",
        "./routes/booking/passengers.tsx",
      ),
      route("/booking/:sessionId/review", "./routes/booking/review.tsx"),
      route("/payment/:bookingId/sepay", "./routes/payment/sepay.tsx"),
      route("/payment/:bookingId/vnpay", "./routes/payment/vnpay.tsx"),
    ]),
  ]),
  layout("./routes/guards/admin.tsx", [
    layout("./routes/layouts/admin.tsx", [
      route(
        ROUTES.adminOrganizations,
        "./routes/admin/organizations/index.tsx",
      ),
      route(
        `${ROUTES.adminOrganizations}/:organizationId`,
        "./routes/admin/organizations/detail.tsx",
      ),
      route(ROUTES.adminStaff, "./routes/admin/staff/index.tsx"),
      route(`${ROUTES.adminStaff}/:staffId`, "./routes/admin/staff/detail.tsx"),
      route(ROUTES.adminBookings, "./routes/admin/bookings/index.tsx"),
      route(
        `${ROUTES.adminBookings}/:bookingId`,
        "./routes/admin/bookings/detail.tsx",
      ),
      route(ROUTES.adminPayments, "./routes/admin/payments/index.tsx"),
      route(
        `${ROUTES.adminPayments}/:paymentId`,
        "./routes/admin/payments/detail.tsx",
      ),
      route(ROUTES.adminRefunds, "./routes/admin/refunds/index.tsx"),
      route(
        `${ROUTES.adminRefunds}/:refundId`,
        "./routes/admin/refunds/detail.tsx",
      ),
    ]),
  ]),
] satisfies RouteConfig;

export type PortalTarget = "customer" | "operator" | "admin" | "all";

/** all is reserved for the regression harness; release apps select a single target. */
export function createPortalRoutes(target: PortalTarget): RouteConfigEntry[] {
  if (target === "all") return allRoutes;
  const root =
    allRoutes[target === "operator" ? 0 : target === "customer" ? 1 : 2];
  if (target === "customer") return [root];
  return [
    index("./routes/portal/index.tsx"),
    route("/login", "./routes/portal/login.tsx"),
    layout("./routes/portal/guard.tsx", [root]),
    route("*", "./routes/not-found.tsx"),
  ];
}
