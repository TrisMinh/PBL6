import { afterEach, expect, it } from "vitest";

import {
  createBookingDraftStore,
  useBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import { mockDb } from "@/mocks/state/mockDb";
import { createReadyBookingSession } from "@/test/booking";

afterEach(() => {
  useBookingDraftStore.getState().clearDraft();
  mockDb.reset();
  sessionStorage.clear();
});
it("preserves a validated attempt through full draft projection/hydration and later same-session save", async () => {
  const session = await createReadyBookingSession();
  useBookingDraftStore
    .getState()
    .setDraft({ ...session, bookingAttemptKey: "stable-key" });
  expect(useBookingDraftStore.getState().draft?.bookingAttemptKey).toBe(
    "stable-key",
  );
  const fresh = createBookingDraftStore();
  await fresh.persist.rehydrate();
  expect(fresh.getState().draft?.bookingAttemptKey).toBe("stable-key");
  useBookingDraftStore.getState().setDraft(session);
  expect(useBookingDraftStore.getState().draft?.bookingAttemptKey).toBe(
    "stable-key",
  );
  useBookingDraftStore
    .getState()
    .setDraft({ ...session, sessionId: "new-session" });
  expect(
    useBookingDraftStore.getState().draft?.bookingAttemptKey,
  ).toBeUndefined();
});
it("rejects malformed persisted attempt key without exposing its payload", async () => {
  const session = await createReadyBookingSession();
  sessionStorage.setItem(
    "blue-booking-draft",
    JSON.stringify({
      version: 0,
      state: { draft: { ...session, bookingAttemptKey: "PRIVATE VALUE" } },
    }),
  );
  const fresh = createBookingDraftStore();
  await fresh.persist.rehydrate();
  expect(fresh.getState().draft).toBeNull();
  expect(sessionStorage.getItem("blue-booking-draft")).toBeNull();
});
