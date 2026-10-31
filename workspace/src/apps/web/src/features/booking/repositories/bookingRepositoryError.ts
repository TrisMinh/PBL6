const ERROR_KEYS = {
  INVALID_CREDENTIALS: "auth.errors.credentials",
  STORAGE_UNAVAILABLE: "tickets.errors.storage",
  ACCESS_REQUIRED: "tickets.errors.access",
  LOOKUP_EXPIRED: "tickets.errors.expired",
  PAYMENT_IN_PROGRESS: "payment.errors.pending",
  PAYMENT_NOT_ALLOWED: "payment.errors.unavailable",
  BOOKING_LOCKED: "booking.errors.locked",
  IDEMPOTENCY_CONFLICT: "booking.errors.attempt",
  HTTP_ERROR: "booking.errors.request",
  NETWORK_ERROR: "booking.errors.network",
  ABORTED: "booking.errors.cancelled",
  INVALID_RESPONSE: "booking.errors.response",
  SEAT_CONFLICT: "booking.errors.conflict",
  HOLD_EXPIRED: "booking.errors.expired",
  SELECTION_LIMIT_EXCEEDED: "booking.errors.limit",
  NOT_FOUND: "booking.errors.missing",
  VALIDATION_ERROR: "booking.errors.validation",
  CANCELLATION_NOT_ALLOWED: "cancellation.errors.notAllowed",
};
export type BookingRepositoryErrorCode = keyof typeof ERROR_KEYS;
export class BookingRepositoryError extends Error {
  readonly messageKey: string;
  readonly canRetry: boolean;
  readonly conflictingSeatIds: readonly string[];
  constructor(
    readonly code: BookingRepositoryErrorCode,
    readonly status = 0,
    conflictingSeatIds: readonly string[] = [],
  ) {
    super("Booking request failed");
    this.name = "BookingRepositoryError";
    this.messageKey = ERROR_KEYS[code];
    this.conflictingSeatIds = Object.freeze([...conflictingSeatIds]);
    this.canRetry =
      code === "NETWORK_ERROR" ||
      code === "INVALID_RESPONSE" ||
      code === "SEAT_CONFLICT" ||
      (code === "HTTP_ERROR" && (status === 429 || status >= 500));
  }
}
