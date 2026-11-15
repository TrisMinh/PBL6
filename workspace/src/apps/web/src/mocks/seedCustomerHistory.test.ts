import { beforeEach, expect, it, vi } from "vitest";
import {
  seedCustomerHistory,
  CUSTOMER_DEMO_EMAIL,
} from "./seedCustomerHistory";
import { mockDb } from "./state/mockDb";
import { httpAuthRepository } from "@/features/auth/repositories/httpAuthRepository";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import { httpPaymentRepository } from "@/features/payment/repositories/httpPaymentRepository";
import { httpCancellationRepository } from "@/features/cancellation/repositories/httpCancellationRepository";

beforeEach(() => {
  mockDb.reset();
  sessionStorage.clear();
});

it("resumes without duplicating bookings when a reload interrupts payment", async () => {
  const create = vi
    .spyOn(httpPaymentRepository, "create")
    .mockRejectedValueOnce(new Error("interrupted before payment"));
  const resolve = vi
    .spyOn(httpPaymentRepository, "resolve")
    .mockRejectedValueOnce(new Error("interrupted after payment creation"));
  try {
    await expect(seedCustomerHistory()).rejects.toThrow(
      "interrupted before payment",
    );
    expect(mockDb.bookings.size).toBe(1);
    expect(mockDb.payments.size).toBe(0);
    await expect(seedCustomerHistory()).rejects.toThrow(
      "interrupted after payment creation",
    );
    expect(mockDb.bookings.size).toBe(1);
    expect(mockDb.payments.size).toBe(1);
    await Promise.all([seedCustomerHistory(), seedCustomerHistory()]);
    expect(mockDb.bookings.size).toBe(4);
    expect(mockDb.payments.size).toBe(4);
    expect(mockDb.tickets.size).toBe(6);
  } finally {
    create.mockRestore();
    resolve.mockRestore();
  }
});

it("seeds linked bookings/payments/tickets with partial cancellation and keeps another customer's ticket private", async () => {
  await seedCustomerHistory();
  expect(mockDb.bookings.size).toBe(4);
  expect(mockDb.payments.size).toBe(4);
  expect(mockDb.tickets.size).toBe(6);
  expect(mockDb.refunds.size).toBe(1);
  expect(
    [...mockDb.tickets.values()].filter(
      (ticket) => ticket.status === "cancelled",
    ),
  ).toHaveLength(1);
  const session = await httpAuthRepository.login({
    email: CUSTOMER_DEMO_EMAIL,
    password: "BlueDemo2026",
  });
  const history = await httpTicketRepository.getHistory(session.token, "all");
  expect(history.items).toHaveLength(5);
  expect(
    history.items.some(
      (ticket) => ticket.passenger.fullName === "Khách tài khoản khác",
    ),
  ).toBe(false);
  const active = history.items.find((ticket) => ticket.status === "issued");
  if (!active) throw Error("missing issued seed");
  const options = await httpCancellationRepository.getOptions(
    active.bookingCode,
    { kind: "account", token: session.token },
  );
  expect(
    options.tickets.some((ticket) => ticket.ticketId === active.ticketId),
  ).toBe(true);
  await seedCustomerHistory();
  expect(mockDb.tickets.size).toBe(6);
  sessionStorage.removeItem("blue-customer-demo-history-v1");
  await seedCustomerHistory();
  expect(mockDb.tickets.size).toBe(6);
});
