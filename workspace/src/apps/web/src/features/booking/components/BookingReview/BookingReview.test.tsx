import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it } from "vitest";

import { BookingReview } from "@/features/booking/components/BookingReview/BookingReview";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";
import { mockDb } from "@/mocks/state/mockDb";
import { createReadyBookingSession } from "@/test/booking";

afterEach(() => mockDb.reset());
it("shows locked notice and hides edit links for an already-created booking", async () => {
  const draft = await createReadyBookingSession();
  const layout = await httpBookingRepository.getSeats(draft.tripId);
  render(
    <MemoryRouter>
      <BookingReview
        draft={{ ...draft, bookingId: "booking-existing" }}
        layout={layout}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "Đặt vé đã được xác nhận",
  );
  expect(
    screen.queryByRole("link", { name: /Chỉnh sửa/ }),
  ).not.toBeInTheDocument();
});
it("reviews trusted trip, seat identities, contact and expandable mock cancellation policy with edit links", async () => {
  const draft = await createReadyBookingSession();
  const layout = await httpBookingRepository.getSeats(draft.tripId);
  render(
    <MemoryRouter>
      <BookingReview draft={draft} layout={layout} />
    </MemoryRouter>,
  );
  const journey = screen.getByRole("region", { name: "Hành trình & nhà xe" });
  expect(journey).toHaveTextContent("BLUE Express");
  expect(journey).toHaveTextContent("07:00");
  expect(journey).toHaveTextContent("13:30");
  expect(journey).toHaveTextContent(layout.trip.originStopName);
  const passengers = screen.getByRole("list", { name: "Hành khách theo ghế" });
  expect(within(passengers).getAllByRole("listitem")).toHaveLength(2);
  expect(passengers).toHaveTextContent("A01");
  expect(passengers).toHaveTextContent("Khách Một");
  expect(passengers).toHaveTextContent("A02");
  expect(passengers).toHaveTextContent("Khách Hai");
  expect(
    screen.queryByRole("region", { name: "Người liên hệ" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Chỉnh sửa hành khách" }),
  ).toHaveAttribute("href", `/booking/${draft.sessionId}/passengers`);
  expect(screen.getByRole("link", { name: "Chỉnh sửa ghế" })).toHaveAttribute(
    "href",
    `/booking/${draft.sessionId}/seats`,
  );
  expect(
    screen.getByText("Hủy và hoàn tiền theo chính sách của chúng tôi"),
  ).toBeVisible();
  const policy = screen.getByText("Xem chính sách");
  expect(policy).toBeVisible();
  await userEvent.click(policy);
  expect(screen.getByText(/Đây là chính sách mô phỏng/i)).toBeVisible();
  expect(
    screen.getByText("Giá cuối cùng được xác nhận bởi hệ thống BLUE"),
  ).toBeVisible();
  expect(screen.getByText("Có mặt 06:40")).toBeVisible();
  expect(document.querySelectorAll(".booking-review img")).toHaveLength(10);
});
