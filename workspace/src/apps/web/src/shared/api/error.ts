export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly correlationId?: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function unavailable(feature: string): never {
  throw new ApiError(
    "FEATURE_UNAVAILABLE",
    501,
    `${feature} chưa được hỗ trợ bởi API hiện tại.`,
  );
}

export async function responseError(response: Response): Promise<ApiError> {
  let body: Record<string, unknown> = {};
  try {
    const value: unknown = await response.json();
    if (typeof value === "object" && value !== null)
      body = value as Record<string, unknown>;
  } catch {
    /* A gateway can return an empty or non-JSON error. */
  }
  const nested =
    typeof body.error === "object" && body.error !== null
      ? (body.error as Record<string, unknown>)
      : body;
  return new ApiError(
    typeof nested.code === "string" ? nested.code : "HTTP_ERROR",
    response.status,
    response.status === 401
      ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
      : response.status === 403
        ? "Bạn không có quyền thực hiện thao tác này."
        : response.status === 429
          ? "Bạn thao tác quá nhanh. Vui lòng thử lại sau."
          : response.status >= 500
            ? "Dịch vụ đang bận. Vui lòng thử lại sau."
            : typeof nested.message === "string"
              ? nested.message
              : "Không thể thực hiện yêu cầu.",
    typeof nested.correlationId === "string"
      ? nested.correlationId
      : typeof body.correlationId === "string"
        ? body.correlationId
        : (response.headers.get("X-Correlation-ID") ?? undefined),
    nested.details,
  );
}
