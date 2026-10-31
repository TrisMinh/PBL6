import { expect, type Page, type Locator } from "@playwright/test";

import { TripResultsPage } from "./TripResultsPage";

export class SeatSelectionPage {
  readonly continueButton: Locator;
  constructor(private readonly page: Page) {
    this.continueButton = page.getByRole("button", {
      name: "Tiếp tục",
      exact: true,
    });
  }
  async start(): Promise<void> {
    const results = new TripResultsPage(this.page);
    await results.goto();
    await results.expectCount(24);
    await results.selectFirst();
    await results.expectBookingStarted();
    await expect(this.seat("A01")).toBeEnabled();
  }
  seat(code: string): Locator {
    return this.page.getByRole("button", { name: `Ghế ${code}`, exact: true });
  }
  async select(code: string): Promise<void> {
    await expect(this.seat(code)).toBeEnabled();
    await this.seat(code).click();
    await expect(this.seat(code)).toHaveAttribute("aria-pressed", "true");
    await expect(this.seat(code)).toBeEnabled();
  }
  async savedDraft(): Promise<string | null> {
    return this.page.evaluate(() =>
      sessionStorage.getItem("blue-booking-draft"),
    );
  }
  async reload(): Promise<void> {
    await this.page.reload();
    await expect(this.seat("A01")).toBeEnabled();
  }
  async continue(): Promise<void> {
    await this.continueButton.click();
    await expect(this.page).toHaveURL(/\/booking\/[^/]+\/passengers$/);
    await expect(
      this.page.getByRole("heading", {
        name: "Thông tin hành khách",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
  }
  async expiredRecovery(): Promise<void> {
    await this.page.goto("/booking/missing/seats");
    await expect(this.page).toHaveURL("/trips?reason=expired");
    await expect(
      this.page.getByRole("heading", { name: "Phiên giữ chỗ đã hết hạn" }),
    ).toBeVisible();
    await expect(
      this.page.getByRole("link", { name: "Tìm lại chuyến" }),
    ).toHaveAttribute("href", "/");
  }

  async holdInCompetingSession(code: string): Promise<void> {
    const status = await this.page.evaluate(async (seatCode) => {
      const raw = sessionStorage.getItem("blue-booking-draft");
      if (!raw) return 0;
      const active = JSON.parse(raw).state.draft;
      const create = await fetch("/api/v1/booking-sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          tripId: active.tripId,
          passengerCount: active.passengerCount,
        }),
      });
      if (!create.ok) return create.status;
      const competing = await create.json();
      const layout = await fetch(
        `/api/v1/trips/${encodeURIComponent(active.tripId)}/seats`,
      ).then((response) => response.json());
      const seat = layout.items.find(
        (item: { code?: unknown }) => item.code === seatCode,
      );
      if (!seat?.id || !competing.sessionId) return 0;
      const hold = await fetch(
        `/api/v1/booking-sessions/${encodeURIComponent(competing.sessionId)}/seats`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seatIds: [seat.id] }),
        },
      );
      return hold.status;
    }, code);
    expect(status).toBe(200);
  }

  async selectConflicting(code: string): Promise<void> {
    await expect(this.seat(code)).toBeEnabled();
    await this.seat(code).click();
  }

  async expectConflictRollback(code: string): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", {
        name: `Vị trí ${code} đã được chọn`,
      }),
    ).toBeVisible();
    const draft = JSON.parse((await this.savedDraft()) ?? "null");
    expect(draft.state.draft.selectedSeatIds).toHaveLength(1);
    await dialog.getByRole("button", { name: "Chọn lại ghế" }).click();
    await expect(this.seat("A01")).toHaveAttribute("aria-pressed", "true");
    await expect(this.seat(code)).toBeDisabled();
  }

  async expireCurrentHold(): Promise<void> {
    await this.page.clock.fastForward(600_001);
    await expect(this.page).toHaveURL(/\/booking\/[^/]+\/seats$/);
    await expect(
      this.page.getByRole("dialog", { name: "Phiên giữ ghế đã hết hạn" }),
    ).toBeVisible();
    expect(await this.savedDraft()).not.toBeNull();
  }
  async recoverExpiredHold(): Promise<void> {
    await this.page.getByRole("link", { name: "Kiểm tra lại chuyến" }).click();
    await expect(this.page).toHaveURL(/\/trips\?/);
    expect(await this.savedDraft()).toBeNull();
  }
}
