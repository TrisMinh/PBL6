const ERROR_KEYS = {
  HTTP_ERROR: "admin.errors.request",
  NETWORK_ERROR: "admin.errors.network",
  ABORTED: "admin.errors.cancelled",
  INVALID_RESPONSE: "admin.errors.response",
  VALIDATION_ERROR: "admin.errors.validation",
} as const;

export type AdminRepositoryErrorCode = keyof typeof ERROR_KEYS;

export class AdminRepositoryError extends Error {
  readonly messageKey: (typeof ERROR_KEYS)[AdminRepositoryErrorCode];
  readonly canRetry: boolean;

  constructor(
    readonly code: AdminRepositoryErrorCode,
    readonly status = 0,
  ) {
    super("Admin request failed");
    this.name = "AdminRepositoryError";
    this.messageKey = ERROR_KEYS[code];
    this.canRetry =
      code === "NETWORK_ERROR" ||
      code === "INVALID_RESPONSE" ||
      (code === "HTTP_ERROR" && (status === 429 || status >= 500));
  }
}
