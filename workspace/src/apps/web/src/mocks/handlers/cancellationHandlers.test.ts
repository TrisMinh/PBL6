import { beforeEach, describe, expect, it } from "vitest";

import { TICKET_ACCESS_HEADER } from "@/features/tickets/config/access";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import { mockDb } from "@/mocks/state/mockDb";
import { issueTestTickets } from "@/test/tickets";
import { httpAuthRepository } from "@/features/auth/repositories/httpAuthRepository";
import { MOCK_SESSION_HEADER } from "@/features/auth/config/session";
import { createMockDb } from "@/mocks/state/mockDb";
import { browserMockStorage } from "@/mocks/state/mockSnapshot";
import {
  collectCancellationArchive,
  validCancellationArchive,
} from "@/mocks/state/cancellationSnapshot";

beforeEach(() => mockDb.reset());

async function setup(): Promise<{
  bookingCode: string;
  token: string;
  ids: string[];
}> {
  const result = await issueTestTickets();
  const access = await httpTicketRepository.lookup({
    bookingCode: result.bookingCode,
    verificationValue: "test+review@example.invalid",
  });
  return {
    bookingCode: result.bookingCode,
    token: access.token,
    ids: result.tickets.map((ticket) => ticket.ticketId),
  };
}

async function cancel(
  setupValue: Awaited<ReturnType<typeof setup>>,
  ticketIds: readonly string[],
  key = "cancel-attempt-1",
): Promise<Response> {
  return fetch(`/api/v1/bookings/${setupValue.bookingCode}/cancellations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": key,
      [TICKET_ACCESS_HEADER]: setupValue.token,
    },
    body: JSON.stringify({ ticketIds }),
  });
}

describe("partial cancellation mock boundary", () => {
  it("cancels one ticket atomically and leaves the other issued", async () => {
    const data = await setup();
    const response = await cancel(data, [data.ids[0]]);
    expect(response.status).toBe(201);
    const refund = await response.json();
    expect(refund).toMatchObject({
      ticketIds: [data.ids[0]],
      seatCodes: ["A01"],
      status: "processing",
      amountVnd: 288000,
    });
    expect(mockDb.tickets.get(data.ids[0])?.status).toBe("cancelled");
    expect(mockDb.tickets.get(data.ids[1])?.status).toBe("issued");
    expect(mockDb.refunds).toHaveLength(1);
  });

  it("cancels both tickets with one processing refund", async () => {
    const data = await setup();
    expect((await cancel(data, data.ids)).status).toBe(201);
    expect([...mockDb.tickets.values()].map((ticket) => ticket.status)).toEqual(
      ["cancelled", "cancelled"],
    );
    expect(mockDb.refunds).toHaveLength(1);
  });

  it("rejects empty, unknown, repeated and already cancelled selections without extra mutation", async () => {
    const data = await setup();
    expect((await cancel(data, [])).status).toBe(400);
    expect((await cancel(data, ["unknown"], "cancel-attempt-2")).status).toBe(
      409,
    );
    const first = await cancel(data, [data.ids[0]], "cancel-attempt-3");
    expect(first.status).toBe(201);
    const ineligible = await cancel(data, [data.ids[0]], "cancel-attempt-4");
    expect(ineligible.status).toBe(409);
    expect(await ineligible.json()).toMatchObject({
      code: "CANCELLATION_NOT_ALLOWED",
    });
    expect(mockDb.refunds).toHaveLength(1);
  });

  it("replays the same key and conflicts when its payload changes", async () => {
    const data = await setup();
    const first = await cancel(data, [data.ids[0]]);
    const replay = await cancel(data, [data.ids[0]]);
    expect(await replay.json()).toEqual(await first.json());
    expect((await cancel(data, [data.ids[1]])).status).toBe(409);
    expect(mockDb.refunds).toHaveLength(1);
  });

  it("requires scoped access and never exposes the private verification proof", async () => {
    const data = await setup();
    const denied = await fetch(
      `/api/v1/bookings/${data.bookingCode}/cancellation`,
    );
    expect(denied.status).toBe(401);
    const allowed = await fetch(
      `/api/v1/bookings/${data.bookingCode}/cancellation`,
      { headers: { [TICKET_ACCESS_HEADER]: data.token } },
    );
    const body = JSON.stringify(await allowed.json());
    expect(allowed.status).toBe(200);
    expect(body).not.toContain("test+review@example.invalid");
    expect(body).not.toContain("0912345678");
  });

  it("does not let a guest token cross into another booking or survive expiry", async () => {
    const first = await setup();
    const crossed = await fetch("/api/v1/bookings/BLUE-OTHER/cancellation", {
      headers: { [TICKET_ACCESS_HEADER]: first.token },
    });
    expect(crossed.status).toBe(404);
    const grant = mockDb.ticketAccess.get(first.token);
    if (grant)
      mockDb.ticketAccess.set(first.token, {
        ...grant,
        expiresAt: new Date(Date.now() - 1).toISOString(),
      });
    expect(
      (
        await fetch(`/api/v1/bookings/${first.bookingCode}/cancellation`, {
          headers: { [TICKET_ACCESS_HEADER]: first.token },
        })
      ).status,
    ).toBe(401);
  });

  it("allows the owning customer session and rejects a different customer", async () => {
    const data = await setup();
    const owner = await httpAuthRepository.login({
      email: "test+review@example.invalid",
      password: "BlueDemo2026",
    });
    const allowed = await fetch(
      `/api/v1/bookings/${data.bookingCode}/cancellations`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "account-cancel",
          [MOCK_SESSION_HEADER]: owner.token,
        },
        body: JSON.stringify({ ticketIds: [data.ids[0]] }),
      },
    );
    expect(allowed.status).toBe(201);
    const admin = await httpAuthRepository.login({
      email: "admin@blue.example.invalid",
      password: "BlueDemo2026",
    });
    const denied = await fetch(
      `/api/v1/bookings/${data.bookingCode}/cancellation`,
      { headers: { [MOCK_SESSION_HEADER]: admin.token } },
    );
    expect(denied.status).toBe(404);
  });

  it("restores cancelled tickets, refund and idempotency replay after refresh", async () => {
    const data = await setup();
    const first = await cancel(data, [data.ids[0]], "refresh-cancel");
    const body = await first.json();
    const fresh = createMockDb({ storage: browserMockStorage });
    fresh.hydrate(Date.now());
    expect(fresh.tickets.get(data.ids[0])?.status).toBe("cancelled");
    expect(fresh.refunds.get(body.refundId)).toEqual(body);
    expect(fresh.cancellationKeys.get("refresh-cancel")?.refundId).toBe(
      body.refundId,
    );
  });

  it("rejects orphan refunds and duplicate refund-key references", async () => {
    const data = await setup();
    expect((await cancel(data, [data.ids[0]], "linked-cancel")).status).toBe(
      201,
    );
    const archive = collectCancellationArchive(mockDb);
    const refund = archive.refunds[0];
    expect(
      validCancellationArchive(
        {
          ...archive,
          refunds: [...archive.refunds, { ...refund, refundId: "orphan" }],
        },
        [...mockDb.tickets.values()],
      ),
    ).toBe(false);
    expect(
      validCancellationArchive(
        {
          ...archive,
          cancellationKeys: [
            ...archive.cancellationKeys,
            { ...archive.cancellationKeys[0], key: "duplicate-reference" },
          ],
        },
        [...mockDb.tickets.values()],
      ),
    ).toBe(false);
  });

  it("keeps bounded refund and key state without mutating a ticket", async () => {
    const data = await setup();
    for (let index = 0; index < 100; index++) {
      const refundId = `refund-${index}`;
      mockDb.refunds.set(refundId, {
        refundId,
        bookingId: "booking-capacity",
        bookingCode: "BLUE-CAPACITY",
        ticketIds: [`ticket-${index}`],
        seatCodes: [`A${String(index + 1).padStart(2, "0")}`],
        amountVnd: 1,
        referenceCode: `RF-CAPACITY-${index}`,
        status: "processing",
        createdAt: new Date().toISOString(),
      });
      mockDb.cancellationKeys.set(`key-${index}`, {
        key: `key-${index}`,
        bookingCode: "BLUE-CAPACITY",
        ticketIds: [`ticket-${index}`],
        refundId,
      });
    }
    expect((await cancel(data, [data.ids[0]], "capacity-attempt")).status).toBe(
      503,
    );
    expect(mockDb.tickets.get(data.ids[0])?.status).toBe("issued");
    expect(mockDb.refunds).toHaveLength(100);
  });
});
