import { expect, test } from "@playwright/test";

import { SeatSelectionPage } from "./pages/SeatSelectionPage";

test("seat selection keeps count/expiry/owned holds after refresh and navigates at exact count", async ({
  page,
}) => {
  const seats = new SeatSelectionPage(page);
  await seats.start();
  await expect(seats.continueButton).toBeDisabled();
  await seats.select("A01");
  await expect(seats.continueButton).toBeDisabled();
  await seats.select("A02");
  await expect(seats.continueButton).toBeEnabled();
  const saved = await seats.savedDraft();
  await seats.reload();
  expect(await seats.savedDraft()).toBe(saved);
  await expect(seats.seat("A01")).toHaveAttribute("aria-pressed", "true");
  await seats.seat("A01").click();
  await expect(seats.seat("A01")).toHaveAttribute("aria-pressed", "false");
  await expect(seats.continueButton).toBeDisabled();
  await seats.select("A01");
  await expect(seats.continueButton).toBeEnabled();
  await seats.continue();
});
test("missing booking session recovers through the dedicated expired Results state", async ({
  page,
}) => {
  await new SeatSelectionPage(page).expiredRecovery();
});
