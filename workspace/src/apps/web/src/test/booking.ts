import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import type { BookingSession } from "@/features/booking/types/booking";

export async function createReadyBookingSession(): Promise<BookingSession> {
  const session = await httpBookingRepository.createSession(
    "trip-hcm-dalat-early",
    2,
  );
  const ids = [`${session.tripId}:A01`, `${session.tripId}:A02`];
  await httpBookingRepository.replaceSeats(session.sessionId, ids);
  return httpBookingRepository.replacePassengers(
    session.sessionId,
    {
      fullName: "Khách Liên Hệ",
      email: "test+review@example.invalid",
      phone: "0912345678",
    },
    [
      { seatId: ids[0], fullName: "Khách Một" },
      { seatId: ids[1], fullName: "Khách Hai", phone: "0987654321" },
    ],
  );
}
