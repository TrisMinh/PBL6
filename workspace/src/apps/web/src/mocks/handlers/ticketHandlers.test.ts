import { beforeEach, describe, expect, it } from "vitest";

import {
  TICKET_ACCESS_HEADER,
  TICKET_ACCESS_TTL_MS,
} from "@/features/tickets/config/access";
import {
  lookupAccessSchema,
  ticketDetailSchema,
} from "@/features/tickets/schemas/ticket.schema";
import { createTicketHandlers } from "@/mocks/handlers/ticketHandlers";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { issueTestTickets } from "@/test/tickets";

let now = Date.now();
beforeEach(() => {
  now = Date.now();
  mockDb.reset();
  server.use(...createTicketHandlers({ db: mockDb, now: () => now }));
});
async function lookup(
  bookingCode: string,
  verificationValue: string,
): Promise<Response> {
  return fetch("/api/v1/tickets/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingCode, verificationValue }),
  });
}
async function detail(code: string, token?: string): Promise<Response> {
  return fetch(`/api/v1/tickets/${encodeURIComponent(code)}`, {
    headers: token ? { [TICKET_ACCESS_HEADER]: token } : {},
  });
}
describe("guest ticket HTTP access", () => {
  it.each([" TEST+REVIEW@EXAMPLE.INVALID ", "+84912345678", "0912345678"])(
    "grants exact ticket scope with normalized contact proof %s",
    async (proof) => {
      const issued = await issueTestTickets();
      const response = await lookup(issued.bookingCode, proof);
      expect(response.status).toBe(200);
      const raw = await response.json(),
        access = lookupAccessSchema.parse(raw);
      expect(Object.keys(raw).sort()).toEqual([
        "expiresAt",
        "ticketCodes",
        "token",
      ]);
      expect(access.ticketCodes).toEqual(
        issued.tickets.map((t) => t.ticketCode),
      );
      expect(Date.parse(access.expiresAt)).toBe(now + TICKET_ACCESS_TTL_MS);
      const read = await detail(access.ticketCodes[0], access.token);
      expect(read.status).toBe(200);
      expect(read.headers.get("Cache-Control")).toBe("no-store");
      const ticket = ticketDetailSchema.parse(await read.json());
      expect(ticket.passenger.fullName).toBe("Khách Một");
      expect(ticket).not.toHaveProperty("guestVerification");
      expect(ticket.passenger).not.toHaveProperty("phone");
      expect(JSON.stringify(raw)).not.toContain("test+review");
    },
  );
  it.each([
    ["BLUE-MISSING", "test+review@example.invalid"],
    ["known", "test+wrong@example.invalid"],
    ["known", "wrong"],
  ])(
    "returns generic sanitized not-found for %s/proof",
    async (code, proof) => {
      const issued = await issueTestTickets();
      const response = await lookup(
        code === "known" ? issued.bookingCode : code,
        proof,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const error = await response.json();
      expect(error).toMatchObject({
        code: "NOT_FOUND",
        status: 404,
        instance: "/api/v1/tickets/lookup",
      });
      expect(JSON.stringify(error)).not.toContain(proof);
    },
  );
  it("requires token header and rejects unknown/extra query authority without leaking names", async () => {
    const issued = await issueTestTickets(),
      code = issued.tickets[0].ticketCode;
    expect((await detail(code)).status).toBe(401);
    expect((await detail(code, "t".repeat(40))).status).toBe(401);
    expect(
      (await fetch(`/api/v1/tickets/${code}?token=${"t".repeat(40)}`)).status,
    ).toBe(401);
    const access = lookupAccessSchema.parse(
      await (
        await lookup(issued.bookingCode, "test+review@example.invalid")
      ).json(),
    );
    const original = [...mockDb.tickets.values()][0];
    mockDb.tickets.set(
      "foreign-ticket",
      Object.freeze({
        ...original,
        ticketId: "foreign-ticket",
        ticketCode: "BLUE-OTHER",
        bookingId: "foreign-booking",
        bookingCode: "BLUE-FOREIGN",
      }),
    );
    expect((await detail("BLUE-OTHER", access.token)).status).toBe(404);
  });
  it("expires at equality, reset revokes access, and never renews a grant on GET", async () => {
    const issued = await issueTestTickets(),
      access = lookupAccessSchema.parse(
        await (
          await lookup(issued.bookingCode, "test+review@example.invalid")
        ).json(),
      );
    now += TICKET_ACCESS_TTL_MS - 1;
    expect((await detail(access.ticketCodes[0], access.token)).status).toBe(
      200,
    );
    now++;
    const expired = await detail(access.ticketCodes[0], access.token);
    expect(expired.status).toBe(410);
    expect(await expired.json()).toMatchObject({ code: "LOOKUP_EXPIRED" });
    mockDb.reset();
    expect((await detail(access.ticketCodes[0], access.token)).status).toBe(
      401,
    );
    expect(issued.tickets).toHaveLength(2);
  });
  it("rejects strict malformed request without echoing private input", async () => {
    const response = await fetch("/api/v1/tickets/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingCode: "BLUE-A",
        verificationValue: "PRIVATE_TEST",
        token: "extra",
      }),
    });
    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain("PRIVATE_TEST");
  });
  it("bounds active grants to100 and accepts another only after expiry", async () => {
    const issued = await issueTestTickets();
    for (let i = 0; i < 100; i++)
      expect(
        (await lookup(issued.bookingCode, "test+review@example.invalid"))
          .status,
      ).toBe(200);
    expect(
      (await lookup(issued.bookingCode, "test+review@example.invalid")).status,
    ).toBe(503);
    now += TICKET_ACCESS_TTL_MS;
    expect(
      (await lookup(issued.bookingCode, "test+review@example.invalid")).status,
    ).toBe(200);
  });
});
