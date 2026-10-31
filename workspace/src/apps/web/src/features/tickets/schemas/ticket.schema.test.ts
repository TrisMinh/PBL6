import { describe, expect, it } from "vitest";

import {
  lookupRequestSchema,
  lookupFormSchema,
  lookupAccessSchema,
  normalizeVerification,
  ticketDetailSchema,
} from "@/features/tickets/schemas/ticket.schema";
import { trips } from "@/mocks/fixtures/trips";

describe("ticket schemas", () => {
  it("accepts the full canonical booking-code bound consistently in form and wire input", () => {
    const input = {
      bookingCode: "BLUE-" + "A".repeat(128),
      verificationValue: "test+guest@example.invalid",
    };
    expect(lookupFormSchema.safeParse(input).success).toBe(true);
    expect(lookupRequestSchema.safeParse(input).success).toBe(true);
  });
  it("lookup request keeps bounded body-only strings and rejects extra fields", () => {
    expect(
      lookupRequestSchema.safeParse({
        bookingCode: " BLUE-ABC ",
        verificationValue: " test+guest@EXAMPLE.invalid ",
      }).data,
    ).toEqual({
      bookingCode: "BLUE-ABC",
      verificationValue: "test+guest@EXAMPLE.invalid",
    });
    expect(
      lookupRequestSchema.safeParse({
        bookingCode: "BLUE-A",
        verificationValue: "x",
        token: "secret",
      }).success,
    ).toBe(false);
    expect(
      lookupRequestSchema.safeParse({
        bookingCode: "x",
        verificationValue: "x".repeat(255),
      }).success,
    ).toBe(false);
  });
  it.each([
    [" Test+Guest@Example.Invalid ", "test+guest@example.invalid"],
    ["0912345678", "+84912345678"],
    [" +84912345678 ", "+84912345678"],
    ["0912 345 678", null],
    ["hello", null],
  ])("normalizeVerification canonicalizes %s", (input, expected) => {
    expect(normalizeVerification(input)).toBe(expected);
  });
  it("lookup form trims and normalizes code while rejecting missing or invalid proof", () => {
    expect(
      lookupFormSchema.safeParse({
        bookingCode: " blue-abc ",
        verificationValue: "test+guest@example.invalid",
      }).data?.bookingCode,
    ).toBe("BLUE-ABC");
    expect(
      lookupFormSchema.safeParse({ bookingCode: "", verificationValue: "" })
        .success,
    ).toBe(false);
    expect(
      lookupFormSchema.safeParse({
        bookingCode: "BLUE-ABC",
        verificationValue: "not-email-or-phone",
      }).success,
    ).toBe(false);
  });
  it("access is readonly, exact and has unique ticket codes without proof", () => {
    const access = {
      token: "t".repeat(40),
      ticketCodes: ["BLUE-ABC"],
      expiresAt: "2099-01-01T00:15:00.000Z",
    };
    expect(Object.isFrozen(lookupAccessSchema.parse(access))).toBe(true);
    expect(
      lookupAccessSchema.safeParse({
        ...access,
        ticketCodes: ["BLUE-ABC", "BLUE-ABC"],
      }).success,
    ).toBe(false);
    expect(
      lookupAccessSchema.safeParse({ ...access, verificationValue: "PRIVATE" })
        .success,
    ).toBe(false);
  });
  it("public detail parses trusted journey and strips every private field", () => {
    const detail = {
      ticketId: "ticket-a",
      ticketCode: "BLUE-ABC",
      bookingId: "booking-a",
      bookingCode: "BLUE-BOOK",
      tripId: trips[0].id,
      trip: trips[0],
      seatId: `${trips[0].id}:A01`,
      seatCode: "A01",
      fareVnd: trips[0].fareVnd,
      status: "issued",
      transactionId: "transaction-a",
      issuedAt: "2098-01-01T00:00:00.000Z",
      passenger: { fullName: "Khách Mô Phỏng", phone: "PRIVATE" },
      guestVerification: { email: "PRIVATE" },
    };
    const parsed = ticketDetailSchema.parse(detail);
    expect(parsed).not.toHaveProperty("guestVerification");
    expect(parsed.passenger).toEqual({ fullName: "Khách Mô Phỏng" });
    expect(
      ticketDetailSchema.safeParse({ ...detail, fareVnd: 1 }).success,
    ).toBe(false);
    expect(
      ticketDetailSchema.safeParse({ ...detail, tripId: "other" }).success,
    ).toBe(false);
  });
});
