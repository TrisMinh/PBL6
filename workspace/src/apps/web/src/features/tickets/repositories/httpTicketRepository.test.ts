import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";

import { TICKET_ACCESS_HEADER } from "@/features/tickets/config/access";
import { httpTicketRepository } from "@/features/tickets/repositories/httpTicketRepository";
import { mockDb } from "@/mocks/state/mockDb";
import { server } from "@/mocks/server";
import { issueTestTickets } from "@/test/tickets";

beforeEach(() => mockDb.reset());
const proof = "test+review@example.invalid";
async function ready(): Promise<{ bookingCode: string }> {
  return issueTestTickets();
}
describe("HTTP ticket repository", () => {
  it("uses body-only proof and header-only token, returning parsed private-free detail", async () => {
    const issued = await ready();
    const access = await httpTicketRepository.lookup({
      bookingCode: issued.bookingCode,
      verificationValue: proof,
    });
    let observed: Request | undefined;
    server.use(
      http.get("/api/v1/tickets/:code", async ({ request }) => {
        observed = request;
        return undefined;
      }),
    );
    const detail = await httpTicketRepository.getDetail(
      access.ticketCodes[0],
      access.token,
    );
    expect(detail.passenger).toEqual({ fullName: "Khách Một" });
    expect(detail).not.toHaveProperty("guestVerification");
    expect(observed?.headers.get(TICKET_ACCESS_HEADER)).toBe(access.token);
    expect(observed?.url).not.toContain(access.token);
    expect(observed?.url).not.toContain(proof);
    expect(Object.isFrozen(detail)).toBe(true);
  });
  it("normalizes failure into static typed code/messageKey without raw server data", async () => {
    const issued = await ready();
    await expect(
      httpTicketRepository.lookup({
        bookingCode: issued.bookingCode,
        verificationValue: "test+wrong@example.invalid",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    server.use(
      http.post("/api/v1/tickets/lookup", () =>
        HttpResponse.json(
          { code: "NOT_FOUND", message: "PRIVATE_TEST" },
          { status: 404 },
        ),
      ),
    );
    await expect(
      httpTicketRepository.lookup({
        bookingCode: issued.bookingCode,
        verificationValue: proof,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Booking request failed",
    });
  });
  it.each(["json", "schema", "past", "future", "pii"])(
    "rejects malformed %s access response",
    async (kind) => {
      server.use(
        http.post("/api/v1/tickets/lookup", () => {
          if (kind === "json")
            return new HttpResponse("bad-json", { status: 200 });
          const access = {
            token: "t".repeat(40),
            ticketCodes: ["BLUE-ABC"],
            expiresAt: new Date(Date.now() + 900000).toISOString(),
          };
          if (kind === "past")
            access.expiresAt = new Date(Date.now() - 1).toISOString();
          if (kind === "future")
            access.expiresAt = new Date(Date.now() + 9000010).toISOString();
          return HttpResponse.json(
            kind === "schema"
              ? {}
              : kind === "pii"
                ? { ...access, verificationValue: "PRIVATE_TEST" }
                : access,
          );
        }),
      );
      await expect(
        httpTicketRepository.lookup({
          bookingCode: "BLUE-ABC",
          verificationValue: proof,
        }),
      ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    },
  );
  it("forwards abort for lookup and detail and blocks invalid inputs before network", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      httpTicketRepository.lookup(
        { bookingCode: "BLUE-ABC", verificationValue: proof },
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "ABORTED" });
    await expect(
      httpTicketRepository.getDetail(
        "BLUE-ABC",
        "t".repeat(40),
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "ABORTED" });
    await expect(
      httpTicketRepository.getDetail("email@example.invalid", "bad"),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
  it("maps missing/expired access safely and rejects a foreign ticket response", async () => {
    const issued = await ready(),
      access = await httpTicketRepository.lookup({
        bookingCode: issued.bookingCode,
        verificationValue: proof,
      });
    const detail = await httpTicketRepository.getDetail(
      access.ticketCodes[0],
      access.token,
    );
    server.use(
      http.get("/api/v1/tickets/:code", () =>
        HttpResponse.json({ ...detail, ticketCode: "BLUE-FOREIGN" }),
      ),
    );
    await expect(
      httpTicketRepository.getDetail(access.ticketCodes[0], access.token),
    ).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    server.use(
      http.get("/api/v1/tickets/:code", () =>
        HttpResponse.json(
          { code: "LOOKUP_EXPIRED", message: "PRIVATE_TEST" },
          { status: 410 },
        ),
      ),
    );
    await expect(
      httpTicketRepository.getDetail(access.ticketCodes[0], access.token),
    ).rejects.toMatchObject({ code: "LOOKUP_EXPIRED", status: 410 });
  });
});
