import { apiFetch as fetch } from "@/shared/api/client";
import { z } from "zod";

import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";

const STATUS = {
  INVALID_CREDENTIALS: 401,
  ACCESS_REQUIRED: 401,
  LOOKUP_EXPIRED: 410,
  PAYMENT_IN_PROGRESS: 409,
  PAYMENT_NOT_ALLOWED: 409,
  BOOKING_LOCKED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  SEAT_CONFLICT: 409,
  HOLD_EXPIRED: 410,
  SELECTION_LIMIT_EXCEEDED: 409,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CANCELLATION_NOT_ALLOWED: 409,
};
const problemSchema = z.object({
  code: z.enum([
    "INVALID_CREDENTIALS",
    "ACCESS_REQUIRED",
    "LOOKUP_EXPIRED",
    "PAYMENT_IN_PROGRESS",
    "PAYMENT_NOT_ALLOWED",
    "BOOKING_LOCKED",
    "IDEMPOTENCY_CONFLICT",
    "SEAT_CONFLICT",
    "HOLD_EXPIRED",
    "SELECTION_LIMIT_EXCEEDED",
    "NOT_FOUND",
    "VALIDATION_ERROR",
    "CANCELLATION_NOT_ALLOWED",
  ]),
  conflictingSeatIds: z.array(z.string()).optional(),
});
export interface BookingHttpOptions {
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
  expectedStatus: number;
  seatIds?: readonly string[];
  headers?: Readonly<Record<string, string>>;
}
async function problemError(
  response: Response,
  options: BookingHttpOptions,
): Promise<BookingRepositoryError> {
  try {
    const parsed = problemSchema.safeParse(await response.json());
    if (parsed.success && STATUS[parsed.data.code] === response.status) {
      const ids = [
        ...new Set(
          (parsed.data.conflictingSeatIds ?? []).filter(
            (id) =>
              /^trip-[A-Za-z0-9-]+:[AB]\d{2}$/.test(id) &&
              options.seatIds?.includes(id),
          ),
        ),
      ].slice(0, 6);
      return new BookingRepositoryError(parsed.data.code, response.status, ids);
    }
  } catch {
    if (options.signal?.aborted) return new BookingRepositoryError("ABORTED");
  }
  return new BookingRepositoryError("HTTP_ERROR", response.status);
}
async function send(
  path: string,
  options: BookingHttpOptions,
): Promise<Response> {
  try {
    return await fetch(path, {
      method: options.method ?? "GET",
      signal: options.signal,
      headers: {
        ...options.headers,
        ...(options.body === undefined
          ? {}
          : { "Content-Type": "application/json" }),
        ...(options.idempotencyKey
          ? { "Idempotency-Key": options.idempotencyKey }
          : {}),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new BookingRepositoryError(
      options.signal?.aborted ? "ABORTED" : "NETWORK_ERROR",
    );
  }
}
export async function requestBooking<T>(
  path: string,
  schema: z.ZodType<T>,
  options: BookingHttpOptions,
): Promise<T> {
  const response = await send(path, options);
  if (!response.ok) throw await problemError(response, options);
  if (response.status !== options.expectedStatus)
    throw new BookingRepositoryError("INVALID_RESPONSE", response.status);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BookingRepositoryError(
      options.signal?.aborted ? "ABORTED" : "INVALID_RESPONSE",
      options.signal?.aborted ? 0 : response.status,
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new BookingRepositoryError("INVALID_RESPONSE", response.status);
  return parsed.data;
}
