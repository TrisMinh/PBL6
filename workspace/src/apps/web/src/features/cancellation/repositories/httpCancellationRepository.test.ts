import { beforeEach, describe, expect, it } from "vitest";

import { httpCancellationRepository } from "@/features/cancellation/repositories/httpCancellationRepository";
import type { CancellationAccess } from "@/features/cancellation/repositories/cancellationRepository";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import { mockDb } from "@/mocks/state/mockDb";
import { issueTestTickets } from "@/test/tickets";

beforeEach(() => mockDb.reset());

describe("httpCancellationRepository", () => {
  it("parses options and creates a typed refund", async () => {
    const issued = await issueTestTickets();
    const grant = await httpTicketRepository.lookup({
      bookingCode: issued.bookingCode,
      verificationValue: "test+review@example.invalid",
    });
    const access: CancellationAccess = { kind: "guest", token: grant.token };
    const options = await httpCancellationRepository.getOptions(
      issued.bookingCode,
      access,
    );
    expect(options.tickets).toHaveLength(2);
    const refund = await httpCancellationRepository.cancel(
      issued.bookingCode,
      [options.tickets[0].ticketId],
      "repository-cancel",
      access,
    );
    expect(refund).toMatchObject({
      status: "processing",
      amountVnd: 288000,
      seatCodes: ["A01"],
      referenceCode: "RF-20260826-0192",
    });
  });

  it.each([
    ["bad booking", ["ticket-1"], "valid-key", "valid-token"],
    ["BLUE-BOOKING", [], "valid-key", "valid-token"],
    ["BLUE-BOOKING", ["ticket-1"], "bad key", "valid-token"],
    ["BLUE-BOOKING", ["ticket-1"], "valid-key", "bad token"],
  ])(
    "rejects malformed client input before a private request",
    async (bookingCode, ids, key, token) => {
      const error = await Promise.resolve()
        .then(() =>
          httpCancellationRepository.cancel(bookingCode, ids, key, {
            kind: "guest",
            token,
          }),
        )
        .catch((reason: unknown) => reason);
      expect(error).toMatchObject({ code: "VALIDATION_ERROR", status: 400 });
    },
  );
});
