const ERROR_MESSAGE_KEYS = {
  HTTP_ERROR: "trips.errors.request",
  NETWORK_ERROR: "trips.errors.network",
  ABORTED: "trips.errors.cancelled",
  INVALID_RESPONSE: "trips.errors.response",
} as const;

export type TripRepositoryErrorCode = keyof typeof ERROR_MESSAGE_KEYS;

export class TripRepositoryError extends Error {
  readonly messageKey: (typeof ERROR_MESSAGE_KEYS)[TripRepositoryErrorCode];
  readonly canRetry: boolean;

  constructor(
    readonly code: TripRepositoryErrorCode,
    readonly status = 0,
  ) {
    super("Trip discovery request failed");
    this.name = "TripRepositoryError";
    this.messageKey = ERROR_MESSAGE_KEYS[code];
    this.canRetry =
      code !== "ABORTED" &&
      (code !== "HTTP_ERROR" || status === 429 || status >= 500);
  }
}
