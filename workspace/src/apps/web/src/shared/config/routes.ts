export const ROUTES = {
  home: "/",
  trips: "/trips",
  explore: "/explore",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  ticketLookup: "/tickets/lookup",
  accountTickets: "/account/tickets",
  adminOrganizations: "/admin/organizations",
  adminStaff: "/admin/staff",
  adminBookings: "/admin/bookings",
  adminPayments: "/admin/payments",
  adminRefunds: "/admin/refunds",
} as const;

export const exploreProvincePath = (slug: string): string =>
  `${ROUTES.explore}/${encodeURIComponent(slug)}`;

export const bookingSeatsPath = (sessionId: string): string =>
  `/booking/${encodeURIComponent(sessionId)}/seats`;
export const bookingPassengersPath = (sessionId: string): string =>
  `/booking/${encodeURIComponent(sessionId)}/passengers`;
export const bookingReviewPath = (sessionId: string): string =>
  `/booking/${encodeURIComponent(sessionId)}/review`;
export const paymentVnPayPath = (bookingId: string): string =>
  `/payment/${encodeURIComponent(bookingId)}/vnpay`;
export const ticketPath = (ticketCode: string): string =>
  `/tickets/${encodeURIComponent(ticketCode)}`;
export const bookingCancellationPath = (bookingCode: string): string =>
  `/bookings/${encodeURIComponent(bookingCode)}/cancel`;

export function paymentReturnPath(
  transactionId: string,
  resultId: string,
): string {
  return (
    "/payment/vnpay/return?" +
    new URLSearchParams({ transactionId, resultId }).toString()
  );
}
