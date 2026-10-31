import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

import { ROUTES } from "./shared/config/routes";

export default [
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
    route(ROUTES.login, "./routes/auth/login.tsx"),
    route(ROUTES.register, "./routes/auth/register.tsx"),
    route("/verify-email", "./routes/auth/verify-email.tsx"),
    route("/reset-password", "./routes/auth/reset-password.tsx"),
    route(ROUTES.forgotPassword, "./routes/auth/forgot-password.tsx"),
    route(ROUTES.ticketLookup, "./routes/tickets/lookup.tsx"),
    layout("./routes/guards/customer-session.tsx", [
      route(ROUTES.accountTickets, "./routes/account/tickets.tsx"),
    ]),
    route("/tickets/:ticketCode", "./routes/tickets/detail.tsx"),
    route("/bookings/:bookingCode/cancel", "./routes/bookings/cancel.tsx"),
    route("/payment/vnpay/return", "./routes/payment/vnpay-return.tsx"),
    route("*", "./routes/not-found.tsx"),
    layout("./routes/guards/booking-session.tsx", [
      route("/booking/:sessionId/seats", "./routes/booking/seats.tsx"),
      route(
        "/booking/:sessionId/passengers",
        "./routes/booking/passengers.tsx",
      ),
      route("/booking/:sessionId/review", "./routes/booking/review.tsx"),
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
