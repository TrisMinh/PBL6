import { describe, it, expect } from "vitest";

import {
  createPassengerSchema,
  type PassengerFormValues,
} from "@/features/booking/schemas/passenger.schema";

const IDS = ["trip:A01", "trip:A02"];
function valid(): PassengerFormValues {
  return {
    contact: {
      fullName: "  Khách Liên Hệ  ",
      email: "  test+mock@example.invalid  ",
      phone: "  +84912345678  ",
    },
    passengers: [
      {
        seatId: IDS[0],
        fullName: "  Khách Thứ Nhất  ",
        phone: "  0912345678  ",
      },
      { seatId: IDS[1], fullName: "  Khách Thứ Hai  ", phone: "   " },
    ],
  };
}
describe("passenger schema bound to the current seats", () => {
  it("bounds raw phone length before trimming for contact and optional passenger phone", () => {
    const value = valid();
    value.contact.phone = " ".repeat(20) + "0912345678";
    expect(createPassengerSchema(IDS).safeParse(value).success).toBe(false);
    const other = valid();
    other.passengers[0].phone = " ".repeat(21);
    expect(createPassengerSchema(IDS).safeParse(other).success).toBe(false);
  });
  it("trims canonical contact/passengers and normalizes optional blank phone", () => {
    const output = createPassengerSchema(IDS).parse(valid());
    expect(output).toEqual({
      contact: {
        fullName: "Khách Liên Hệ",
        email: "test+mock@example.invalid",
        phone: "+84912345678",
      },
      passengers: [
        { seatId: IDS[0], fullName: "Khách Thứ Nhất", phone: "0912345678" },
        { seatId: IDS[1], fullName: "Khách Thứ Hai", phone: undefined },
      ],
    });
  });
  it.each(["", " ", "A", "a".repeat(101)])(
    "rejects contact/passenger name%s",
    (fullName) => {
      const value = valid();
      value.contact.fullName = fullName;
      value.passengers[0].fullName = fullName;
      expect(createPassengerSchema(IDS).safeParse(value).success).toBe(false);
    },
  );
  it.each(["", "missing-at", "x@", "x".repeat(245) + "@example.invalid"])(
    "rejects email%s",
    (email) => {
      const value = valid();
      value.contact.email = email;
      expect(createPassengerSchema(IDS).safeParse(value).success).toBe(false);
    },
  );
  it.each([
    "0312345678",
    "0512345678",
    "0712345678",
    "0812345678",
    "0912345678",
    "+84312345678",
    "+84512345678",
    "+84712345678",
    "+84812345678",
    "+84912345678",
  ])("accepts approved mobile%s", (phone) => {
    const value = valid();
    value.contact.phone = phone;
    value.passengers[0].phone = phone;
    expect(createPassengerSchema(IDS).safeParse(value).success).toBe(true);
  });
  it.each([
    "",
    "0212345678",
    "0612345678",
    "01123456789",
    "+840912345678",
    "84912345678",
    "09123",
    "09123456789",
    "09 12345678",
    "０９１２３４５６７８",
    "+84912345678".repeat(2),
  ])("rejects contact and present passenger phone%s", (phone) => {
    const value = valid();
    value.contact.phone = phone;
    expect(createPassengerSchema(IDS).safeParse(value).success).toBe(false);
    if (phone) {
      value.contact.phone = "0912345678";
      value.passengers[0].phone = phone;
      expect(createPassengerSchema(IDS).safeParse(value).success).toBe(false);
    }
  });
  it("accepts omitted passenger phone and does not require equal contact/passenger names", () => {
    const value = valid();
    const passenger = value.passengers[0];
    if (!passenger) throw new Error("Expected passenger");
    const { phone, ...withoutPhone } = passenger;
    void phone;
    value.passengers[1].phone = "";
    expect(
      createPassengerSchema(IDS).safeParse({
        ...value,
        passengers: [withoutPhone, value.passengers[1]],
      }).success,
    ).toBe(true);
  });
  it.each(["missing", "duplicate", "foreign", "stale", "extra"])(
    "rejects %s seat correspondence",
    (mode) => {
      const value = valid();
      const first = value.passengers[0];
      if (!first) throw new Error("Expected passenger");
      const passengers =
        mode === "missing"
          ? value.passengers.slice(0, 1)
          : mode === "duplicate"
            ? [first, first]
            : mode === "foreign"
              ? [first, { ...first, seatId: "foreign" }]
              : mode === "stale"
                ? [first, { ...first, seatId: "trip:B01" }]
                : [...value.passengers, { ...first, seatId: "trip:B01" }];
      expect(
        createPassengerSchema(IDS).safeParse({ ...value, passengers }).success,
      ).toBe(false);
    },
  );
  it.each(
    [
      [],
      [""],
      ["   "],
      ["trip:A01", "trip:A01"],
      Array.from({ length: 7 }, (_, i) => String(i)),
    ].map((ids) => ({ ids })),
  )("rejects invalid construction selection%j", ({ ids }) => {
    expect(() => createPassengerSchema(ids)).toThrow();
  });
  it("copies its selected-seat boundary so a later caller mutation cannot change it", () => {
    const ids = [...IDS];
    const schema = createPassengerSchema(ids);
    ids[1] = "foreign";
    expect(schema.safeParse(valid()).success).toBe(true);
    expect(
      schema.safeParse({
        ...valid(),
        passengers: [
          { seatId: IDS[0], fullName: "Khách Một" },
          { seatId: "foreign", fullName: "Khách Hai" },
        ],
      }).success,
    ).toBe(false);
  });
  it("allows reordered exact rows and safe-parses wrong primitive/root shapes", () => {
    const value = valid();
    expect(
      createPassengerSchema(IDS).safeParse({
        ...value,
        passengers: [...value.passengers].reverse(),
      }).success,
    ).toBe(true);
    for (const input of [
      null,
      {},
      [],
      { ...value, contact: { ...value.contact, phone: 123 } },
      { ...value, passengers: "PRIVATE" },
    ])
      expect(createPassengerSchema(IDS).safeParse(input).success).toBe(false);
  });
});
