import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import { sessionTokenSchema } from "@/features/auth/schemas/session.schema";
import {
  cancellationKeySchema,
  cancellationOptionsSchema,
  cancellationRequestSchema,
  refundSchema,
} from "@/features/cancellation/schemas/cancellation.schema";
import type {
  CancellationAccess,
  CancellationRepository,
} from "@/features/cancellation/repositories/cancellationRepository";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";
import { requestBooking } from "@/features/booking/repositories/bookingHttp";
import { TICKET_ACCESS_HEADER } from "@/features/tickets/config/access";
import {
  lookupTokenSchema,
  ticketCodeSchema,
} from "@/features/tickets/schemas/ticket.schema";

function headers(access: CancellationAccess): Readonly<Record<string, string>> {
  const schema =
    access.kind === "guest" ? lookupTokenSchema : sessionTokenSchema;
  if (!schema.safeParse(access.token).success)
    throw new BookingRepositoryError("VALIDATION_ERROR", 400);
  return access.kind === "guest"
    ? { [TICKET_ACCESS_HEADER]: access.token }
    : { [MOCK_SESSION_HEADER]: access.token };
}

function bookingPath(bookingCode: string, suffix: string): string {
  if (!ticketCodeSchema.safeParse(bookingCode).success)
    throw new BookingRepositoryError("VALIDATION_ERROR", 400);
  return `/api/v1/bookings/${encodeURIComponent(bookingCode)}${suffix}`;
}

export const httpCancellationRepository: CancellationRepository = {
  getOptions: (bookingCode, access, signal) =>
    requestBooking(
      bookingPath(bookingCode, "/cancellation"),
      cancellationOptionsSchema,
      { headers: headers(access), signal, expectedStatus: 200 },
    ),
  cancel: (bookingCode, ticketIds, idempotencyKey, access, signal) => {
    const input = cancellationRequestSchema.safeParse({ ticketIds });
    if (
      !input.success ||
      !cancellationKeySchema.safeParse(idempotencyKey).success
    )
      throw new BookingRepositoryError("VALIDATION_ERROR", 400);
    return requestBooking(
      bookingPath(bookingCode, "/cancellations"),
      refundSchema,
      {
        method: "POST",
        body: input.data,
        idempotencyKey,
        headers: headers(access),
        signal,
        expectedStatus: 201,
      },
    );
  },
};
