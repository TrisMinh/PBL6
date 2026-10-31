import { describe, expect, it } from "vitest";

import {
  bookingPassengersPath,
  bookingReviewPath,
  bookingSeatsPath,
  ticketPath,
  paymentVnPayPath,
} from "@/shared/config/routes";

describe.each([
  {
    name: "paymentVnPayPath",
    buildPath: paymentVnPayPath,
    expected: "/payment/A%2FB/vnpay",
  },
  {
    name: "bookingSeatsPath",
    buildPath: bookingSeatsPath,
    expected: "/booking/A%2FB/seats",
  },
  {
    name: "bookingPassengersPath",
    buildPath: bookingPassengersPath,
    expected: "/booking/A%2FB/passengers",
  },
  {
    name: "bookingReviewPath",
    buildPath: bookingReviewPath,
    expected: "/booking/A%2FB/review",
  },
  {
    name: "ticketPath",
    buildPath: ticketPath,
    expected: "/tickets/A%2FB",
  },
])("$name", ({ name, buildPath, expected }) => {
  it(`${name} with a slash in the ID keeps it inside one encoded path segment`, () => {
    expect(buildPath("A/B")).toBe(expected);
  });
});
