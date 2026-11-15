import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import { httpCancellationRepository } from "@/features/cancellation/repositories/httpCancellationRepository";
import { mockDb } from "./state/mockDb";
import { demoTrips } from "./fixtures/demoTrips";

const MARKER = "blue-customer-demo-history-v1";
export const CUSTOMER_DEMO_EMAIL = "test+review@example.invalid";

/** Build a linked demo history through the same mock mutations used by the UI. */
let inFlight: Promise<void> | undefined;
export function seedCustomerHistory(): Promise<void> {
  if (!inFlight)
    inFlight = seedHistory().finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}
async function seedHistory(): Promise<void> {
  mockDb.hydrate(Date.now());
  if (
    sessionStorage.getItem(MARKER) === "ready" &&
    [...mockDb.tickets.values()].some(
      (ticket) => ticket.passenger.fullName === "Nguyễn Minh An",
    )
  )
    return;
  const seeds = [
    {
      trip: demoTrips[1],
      names: ["Nguyễn Minh An", "Trần Thu Hà"],
      email: CUSTOMER_DEMO_EMAIL,
      cancelFirst: false,
    },
    {
      trip: demoTrips[4],
      names: ["Nguyễn Minh An", "Lê Hoàng Long"],
      email: CUSTOMER_DEMO_EMAIL,
      cancelFirst: true,
    },
    {
      trip: demoTrips[170],
      names: ["Nguyễn Minh An"],
      email: CUSTOMER_DEMO_EMAIL,
      cancelFirst: false,
    },
    {
      trip: demoTrips[250],
      names: ["Khách tài khoản khác"],
      email: "another-customer@example.invalid",
      cancelFirst: false,
    },
  ];
  for (const [index, seed] of seeds.entries()) {
    if (!seed.trip) continue;
    const key = `customer-demo-history-v1-${index}`;
    const previousId = mockDb.paymentKeys.get(`${key}-payment`);
    const previous = previousId
      ? mockDb.payments.get(previousId)?.result
      : undefined;
    let result = previous;
    if (!result) {
      const previousBookingId = mockDb.bookingKeys.get(`${key}-booking`);
      let booking = previousBookingId
        ? mockDb.bookings.get(previousBookingId)
        : undefined;
      if (!booking) {
        const session = await httpBookingRepository.createSession(
          seed.trip.id,
          seed.names.length,
          { idempotencyKey: key },
        );
        // Seats A03/A04 preserve the first-seat tutorial path for new bookings.
        const ids = seed.names.map(
          (_, seat) => `${seed.trip.id}:A0${seat + 3}`,
        );
        await httpBookingRepository.replaceSeats(session.sessionId, ids);
        await httpBookingRepository.replacePassengers(
          session.sessionId,
          {
            fullName: seed.names[0],
            email: seed.email,
            phone: "0912345678",
          },
          seed.names.map((fullName, seat) => ({ fullName, seatId: ids[seat] })),
        );
        booking = await httpBookingRepository.createBooking(
          session.sessionId,
          `${key}-booking`,
        );
      }
      const transaction =
        (previousId
          ? mockDb.payments.get(previousId)?.transaction
          : undefined) ??
        (await httpPaymentRepository.create(booking.bookingId, {
          key: `${key}-payment`,
          scenario: "success",
        }));
      result = await httpPaymentRepository.resolve(
        transaction.transactionId,
        transaction.resultId,
      );
    }
    if (seed.cancelFirst && result.tickets[0]) {
      const lookup = await httpTicketRepository.lookup({
        bookingCode: result.bookingCode,
        verificationValue: seed.email,
      });
      await httpCancellationRepository.cancel(
        result.bookingCode,
        [result.tickets[0].ticketId],
        `${key}-cancel`,
        { kind: "guest", token: lookup.token },
      );
    }
  }
  sessionStorage.setItem(MARKER, "ready");
}
