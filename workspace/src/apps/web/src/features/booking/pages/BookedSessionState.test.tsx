import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";

import { SeatSelectionPage } from "@/features/booking/pages/SeatSelectionPage";
import { PassengerDetailsPage } from "@/features/booking/pages/PassengerDetailsPage";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { mockDb } from "@/mocks/state/mockDb";
import { createReadyBookingSession } from "@/test/booking";
import { httpBookingRepository } from "@/features/booking/repositories/httpBookingRepository";

afterEach(() => {
  cleanup();
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
});
it.each(["seats", "passengers"])(
  "recovers remote BOOKING_LOCKED after a lost create response from %s",
  async (mode) => {
    const draft = await createReadyBookingSession();
    useBookingDraftStore
      .getState()
      .setDraft({ ...draft, bookingAttemptKey: "lost-response-key" });
    await httpBookingRepository.createBooking(
      draft.sessionId,
      "lost-response-key",
    );
    const Page = mode === "seats" ? SeatSelectionPage : PassengerDetailsPage;
    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false, gcTime: 0 },
      },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    if (mode === "seats")
      await userEvent.click(
        await screen.findByRole("button", { name: "Ghế A01" }),
      );
    else {
      await screen.findByLabelText("Email nhận vé");
      await userEvent.click(
        screen.getByRole("button", { name: "Xác nhận thông tin" }),
      );
    }
    expect(
      await screen.findByRole("link", { name: "Xem lại đặt vé" }),
    ).toHaveAttribute("href", `/booking/${draft.sessionId}/review`);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Đặt vé đã được xác nhận",
    );
    if (mode === "seats")
      expect(screen.getByRole("button", { name: "Ghế A01" })).toBeDisabled();
    else {
      expect(screen.getByLabelText("Email nhận vé")).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Xác nhận thông tin" }),
      ).toBeDisabled();
      expect(
        screen.queryByRole("button", { name: "Đang xử lý" }),
      ).not.toBeInTheDocument();
    }
    expect(useBookingDraftStore.getState().draft?.bookingId).toBeUndefined();
    expect(useBookingDraftStore.getState().draft?.expiresAt).toBe(
      draft.expiresAt,
    );
    expect(mockDb.bookings.size).toBe(1);
    cleanup();
    client.clear();
  },
);
it.each([SeatSelectionPage, PassengerDetailsPage])(
  "prevents editing an already-booked draft through direct/back navigation",
  async (Page) => {
    const draft = await createReadyBookingSession();
    useBookingDraftStore.getState().setDraft({
      ...draft,
      bookingId: "booking-existing",
      bookingAttemptKey: "stable-key",
    });
    const before = useBookingDraftStore.getState().draft;
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(
      await screen.findByRole("heading", { name: "Đặt vé đã được xác nhận" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Xem lại đặt vé" }),
    ).toHaveAttribute("href", `/booking/${draft.sessionId}/review`);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "Ghế A01" }),
    ).not.toBeInTheDocument();
    expect(useBookingDraftStore.getState().draft).toBe(before);
    cleanup();
    client.clear();
  },
);
