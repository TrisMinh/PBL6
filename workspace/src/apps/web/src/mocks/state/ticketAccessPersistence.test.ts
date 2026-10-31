import { describe, expect, it } from "vitest";

import {
  TICKET_ACCESS_HEADER,
  TICKET_ACCESS_TTL_MS,
} from "@/features/tickets/config/access";
import { lookupAccessSchema } from "@/features/tickets/schemas/ticket.schema";
import { createBookingHandlers } from "@/mocks/handlers/bookingHandlers";
import { createOrderHandlers } from "@/mocks/handlers/createBookingHandlers";
import { createPaymentHandlers } from "@/mocks/handlers/paymentHandlers";
import { createTicketHandlers } from "@/mocks/handlers/ticketHandlers";
import { createMockDb } from "@/mocks/state/mockDb";
import {
  MOCK_BOOKING_STORAGE_KEY,
  type MockStorage,
} from "@/mocks/state/mockSnapshot";
import { server } from "@/mocks/server";
import { issueTestTickets } from "@/test/tickets";

async function setup(): Promise<{
  storage: MockStorage;
  now: number;
  code: string;
  token: string;
}> {
  const values = new Map<string, string>();
  const storage: MockStorage = {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => {
      values.set(k, v);
    },
    removeItem: (k) => {
      values.delete(k);
    },
  };
  const db = createMockDb({ storage }),
    now = Date.now();
  server.use(
    ...createBookingHandlers({ db, now: () => now }),
    ...createOrderHandlers({ db, now: () => now }),
    ...createPaymentHandlers({ db, now: () => now }),
    ...createTicketHandlers({ db, now: () => now }),
  );
  const issued = await issueTestTickets();
  const response = await fetch("/api/v1/tickets/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bookingCode: issued.bookingCode,
      verificationValue: "test+review@example.invalid",
    }),
  });
  const access = lookupAccessSchema.parse(await response.json());
  return { storage, now, code: access.ticketCodes[0], token: access.token };
}
describe("mock lookup persistence", () => {
  it("restores the same scoped grant on reload without renewing expiry or persisting submitted proof", async () => {
    const { storage, now, code, token } = await setup();
    const original = storage.getItem(MOCK_BOOKING_STORAGE_KEY);
    const db = createMockDb({ storage });
    server.use(...createTicketHandlers({ db, now: () => now + 1000 }));
    const response = await fetch(`/api/v1/tickets/${code}`, {
      headers: { [TICKET_ACCESS_HEADER]: token },
    });
    expect(response.status).toBe(200);
    expect(db.ticketAccess.get(token)?.expiresAt).toBe(
      new Date(now + 900000).toISOString(),
    );
    expect(original).not.toContain("verificationValue");
    db.reset();
    expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  });
  it("discards expired access while preserving the issued payment/tickets", async () => {
    const { storage, now, code, token } = await setup(),
      db = createMockDb({ storage });
    server.use(
      ...createTicketHandlers({ db, now: () => now + TICKET_ACCESS_TTL_MS }),
    );
    expect(
      (
        await fetch(`/api/v1/tickets/${code}`, {
          headers: { [TICKET_ACCESS_HEADER]: token },
        })
      ).status,
    ).toBe(401);
    expect(db.ticketAccess.size).toBe(0);
    expect(db.tickets.size).toBe(2);
  });
  it.each(["scope", "ttl", "duplicate", "proof", "capacity"])(
    "fails closed for malformed %s grants",
    async (kind) => {
      const { storage, now, code, token } = await setup();
      const snapshot = JSON.parse(
        storage.getItem(MOCK_BOOKING_STORAGE_KEY) ?? "{}",
      );
      const grant = {
        token,
        ticketCodes: [code],
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + 900000).toISOString(),
      };
      snapshot.ticketAccess = [grant];
      if (kind === "scope") grant.ticketCodes = ["BLUE-FOREIGN"];
      if (kind === "ttl")
        grant.expiresAt = new Date(now + 900001).toISOString();
      if (kind === "duplicate") snapshot.ticketAccess = [grant, grant];
      if (kind === "proof")
        snapshot.ticketAccess = [
          { ...grant, verificationValue: "PRIVATE_TEST" },
        ];
      if (kind === "capacity")
        snapshot.ticketAccess = Array.from({ length: 101 }, () => grant);
      storage.setItem(MOCK_BOOKING_STORAGE_KEY, JSON.stringify(snapshot));
      const db = createMockDb({ storage });
      db.hydrate(now);
      expect(db.ticketAccess.size).toBe(0);
      expect(storage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
    },
  );
});
