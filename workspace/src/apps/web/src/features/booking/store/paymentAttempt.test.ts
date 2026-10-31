import { afterEach, expect, it } from "vitest";

import type { PaymentAttempt } from "@/features/payment/types/payment";
import {
  createBookingDraftStore,
  BOOKING_DRAFT_STORAGE_KEY,
} from "@/features/booking/store/bookingDraftStore";
import { mockDb } from "@/mocks/state/mockDb";
import { createReadyBookingSession } from "@/test/booking";

afterEach(() => mockDb.reset());
it("projects a detached payment key/scenario/opaque IDs and hydrates it without changing original expiry", async () => {
  const draft = await createReadyBookingSession();
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const store = createBookingDraftStore(storage);
  const attempt: PaymentAttempt = {
    key: "payment-key",
    scenario: "success",
    transactionId: "tx",
    resultId: "result",
  };
  store
    .getState()
    .setDraft({ ...draft, bookingId: "booking", paymentAttempt: attempt });
  expect(store.getState().draft?.paymentAttempt).toEqual(attempt);
  expect(store.getState().draft?.paymentAttempt).not.toBe(attempt);
  const fresh = createBookingDraftStore(storage);
  await fresh.persist.rehydrate();
  expect(fresh.getState().draft).toMatchObject({
    expiresAt: draft.expiresAt,
    paymentAttempt: attempt,
  });
  store
    .getState()
    .setDraft({ ...draft, bookingId: "booking", paymentAttempt: undefined });
  expect(store.getState().draft?.paymentAttempt).toBeUndefined();
  expect(store.getState().draft?.expiresAt).toBe(draft.expiresAt);
  expect(storage.getItem(BOOKING_DRAFT_STORAGE_KEY)).not.toContain(
    "payment-key",
  );
});
it.each([
  { key: "bad key", scenario: "success" },
  { key: "key", scenario: "unknown" },
  { key: "key", scenario: "pending", transactionId: "tx" },
])(
  "fails malformed persisted payment metadata closed",
  async (paymentAttempt) => {
    const draft = await createReadyBookingSession();
    let raw: string | null = JSON.stringify({
      state: { draft: { ...draft, paymentAttempt } },
      version: 0,
    });
    const store = createBookingDraftStore({
      getItem: () => raw,
      setItem: (_k, v) => {
        raw = v;
      },
      removeItem: () => {
        raw = null;
      },
    });
    await store.persist.rehydrate();
    expect(store.getState().draft).toBeNull();
    expect(raw).toBeNull();
  },
);
