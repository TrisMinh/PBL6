import { afterEach, describe, expect, it, vi } from "vitest";
import type { StateStorage } from "zustand/middleware";

import {
  BOOKING_DRAFT_STORAGE_KEY,
  createBookingDraftStore,
  useBookingDraftStore,
} from "@/features/booking/store/bookingDraftStore";
import type { BookingSession } from "@/features/booking/types/booking";

const storageKey = BOOKING_DRAFT_STORAGE_KEY;
const draft = {
  passengerCount: 2,
  sessionId: "test-session",
  bookingId: "test-booking",
  tripId: "test-trip",
  selectedSeatIds: ["test-seat-1"],
  passengers: [{ seatId: "test-seat-1", fullName: "Khách mô phỏng" }],
  expiresAt: "2099-01-01T00:00:00Z",
  totalVnd: 280_000,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useBookingDraftStore.getState().clearDraft();
  sessionStorage.clear();
  vi.useRealTimers();
});

function fakeStorage(raw?: string): {
  storage: StateStorage;
  values: Map<string, string>;
  read: ReturnType<typeof vi.fn>;
} {
  const values = new Map<string, string>(
    raw === undefined ? [] : [[storageKey, raw]],
  );
  const read = vi.fn((key: string) => values.get(key) ?? null);
  return {
    values,
    read,
    storage: {
      getItem: read,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    },
  };
}

function persisted(value: unknown): string {
  return JSON.stringify({ state: { draft: value }, version: 0 });
}

describe("bookingDraftStore", () => {
  it("setDraft stores a detached draft projection from a BookingSession, excluding server status", () => {
    const session: BookingSession = {
      ...draft,
      selectedSeatIds: [...draft.selectedSeatIds],
      passengers: draft.passengers.map((passenger) => ({ ...passenger })),
      status: "active",
    };
    useBookingDraftStore.getState().setDraft(session);
    session.selectedSeatIds.push("test-extra-seat");
    expect(useBookingDraftStore.getState().draft).toEqual(draft);
    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? "null")).toEqual({
      state: { draft },
      version: 0,
    });
  });

  it("setDraft persists the complete draft under the canonical key", () => {
    expect(storageKey).toBe("blue-booking-draft");
    useBookingDraftStore.getState().setDraft(draft);
    expect(useBookingDraftStore.getState().draft).toEqual(draft);
    expect(sessionStorage.getItem(storageKey)).not.toBeNull();
    expect(JSON.parse(sessionStorage.getItem(storageKey) ?? "null")).toEqual({
      state: { draft },
      version: 0,
    });
  });

  it("replaceSeats replaces selection and total without resetting expiry or mutating the previous draft", () => {
    const state = useBookingDraftStore.getState();
    expect(state).toHaveProperty("replaceSeats", expect.any(Function));
    state.setDraft(draft);
    const previous = useBookingDraftStore.getState().draft;
    state.replaceSeats(["test-seat-2"], 320_000);
    expect(useBookingDraftStore.getState().draft).toEqual({
      ...draft,
      selectedSeatIds: ["test-seat-2"],
      totalVnd: 320_000,
    });
    expect(previous).toEqual(draft);
  });

  it("setContact updates only contact and preserves booking identity", () => {
    const state = useBookingDraftStore.getState();
    expect(state).toHaveProperty("setContact", expect.any(Function));
    state.setDraft(draft);
    const contact = {
      fullName: "Khách mô phỏng",
      email: "test+booking@example.invalid",
      phone: "0900000000",
    };
    state.setContact(contact);
    expect(useBookingDraftStore.getState().draft).toEqual({
      ...draft,
      contact,
    });
  });

  it("setPassengers replaces passengers without changing seats, total or expiry", () => {
    const state = useBookingDraftStore.getState();
    expect(state).toHaveProperty("setPassengers", expect.any(Function));
    state.setDraft(draft);
    const passengers = [{ seatId: "test-seat-1", fullName: "Khách khác" }];
    state.setPassengers(passengers);
    expect(useBookingDraftStore.getState().draft).toEqual({
      ...draft,
      passengers,
    });
  });

  it("clearDraft removes the persisted draft as well as in-memory data", () => {
    useBookingDraftStore.getState().setDraft(draft);
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ state: { draft }, version: 0 }),
    );
    useBookingDraftStore.getState().clearDraft();
    expect(useBookingDraftStore.getState().draft).toBeNull();
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it("hydrates only when explicitly requested and preserves the original expiresAt", async () => {
    expect(useBookingDraftStore).toHaveProperty(
      "persist.rehydrate",
      expect.any(Function),
    );
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ state: { draft }, version: 0 }),
    );
    expect(useBookingDraftStore.getState().draft).toBeNull();
    await useBookingDraftStore.persist.rehydrate();
    expect(useBookingDraftStore.getState().draft).toEqual(draft);
  });

  it("factory hydration uses fake storage lazily and restores only draft data, keeping actions trusted", async () => {
    const { storage, read } = fakeStorage(
      JSON.stringify({
        state: { draft, setDraft: "untrusted action" },
        version: 0,
      }),
    );
    const store = createBookingDraftStore(storage);
    expect(read).not.toHaveBeenCalled();
    expect(store.getState().draft).toBeNull();
    await store.persist.rehydrate();
    expect(read).toHaveBeenCalledWith(storageKey);
    expect(store.getState().draft).toEqual(draft);
    expect(store.getState().setDraft).toBeTypeOf("function");
  });

  it.each([
    ["malformed JSON", "{PRIVATE_INVALID"],
    ["null", persisted(null)],
    ["wrong primitive", persisted("PRIVATE_INVALID")],
    [
      "incomplete legacy boundary",
      persisted({ sessionId: draft.sessionId, expiresAt: draft.expiresAt }),
    ],
    ["missing trip", persisted({ ...draft, tripId: "" })],
    ["invalid expiry", persisted({ ...draft, expiresAt: "not-a-date" })],
    ["expired", persisted({ ...draft, expiresAt: "2000-01-01T00:00:00Z" })],
    ["fractional total", persisted({ ...draft, totalVnd: 0.5 })],
    ["negative total", persisted({ ...draft, totalVnd: -1 })],
    ["invalid seats", persisted({ ...draft, selectedSeatIds: [7] })],
    [
      "invalid contact",
      persisted({ ...draft, contact: { fullName: "Khách" } }),
    ],
    [
      "invalid passengers",
      persisted({ ...draft, passengers: [{ seatId: "test-seat-1" }] }),
    ],
  ])(
    "hydration fails closed for %s and removes invalid persisted data",
    async (_name, raw) => {
      const { storage, values } = fakeStorage(raw);
      const store = createBookingDraftStore(storage);
      await store.persist.rehydrate();
      expect(store.getState().draft).toBeNull();
      expect(values.has(storageKey)).toBe(false);
    },
  );

  it("hydration strips fields outside the draft contract", async () => {
    const { storage } = fakeStorage(
      persisted({
        ...draft,
        contact: {
          fullName: "",
          email: "",
          phone: "",
          privateField: "PRIVATE_INVALID",
        },
        privateField: "PRIVATE_INVALID",
        status: "completed",
      }),
    );
    const store = createBookingDraftStore(storage);
    await store.persist.rehydrate();
    expect(store.getState().draft).toEqual({
      ...draft,
      contact: { fullName: "", email: "", phone: "" },
    });
  });

  it("expired-at-boundary hydration never grants a fresh hold", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(draft.expiresAt));
    const { storage } = fakeStorage(persisted(draft));
    const store = createBookingDraftStore(storage);
    await store.persist.rehydrate();
    expect(store.getState().draft).toBeNull();
  });

  it("updates with no draft stay empty and do not create persisted data", () => {
    const { storage, values } = fakeStorage();
    const store = createBookingDraftStore(storage);
    store.getState().replaceSeats([], 0);
    store.getState().setContact({ fullName: "", email: "", phone: "" });
    store.getState().setPassengers([]);
    expect(store.getState().draft).toBeNull();
    expect(values.size).toBe(0);
  });

  it("fake-storage round trip retains all updates and canonical expiry", async () => {
    const { storage, values } = fakeStorage();
    const first = createBookingDraftStore(storage);
    first.getState().setDraft({
      ...draft,
      contact: { fullName: "", email: "", phone: "" },
      passengers: [
        {
          ...draft.passengers[0],
          seatId: "test-seat-1",
          fullName: "Khách",
          phone: "0900000000",
        },
      ],
    });
    first.getState().replaceSeats(["test-seat-2"], 320_000);
    first.getState().setContact({
      fullName: "Khách",
      email: "test+booking@example.invalid",
      phone: "0900000000",
    });
    first
      .getState()
      .setPassengers([{ seatId: "test-seat-2", fullName: "Khách" }]);
    const refreshed = createBookingDraftStore(storage);
    await refreshed.persist.rehydrate();
    expect(refreshed.getState().draft).toEqual(first.getState().draft);
    expect(refreshed.getState().draft?.expiresAt).toBe(draft.expiresAt);
    refreshed.getState().clearDraft();
    expect(values.size).toBe(0);
  });

  it("module import and factory construction do not resolve sessionStorage or read data", async () => {
    const property = vi.spyOn(window, "sessionStorage", "get");
    const read = vi.spyOn(Storage.prototype, "getItem");
    vi.resetModules();
    const module = await import("@/features/booking/store/bookingDraftStore");
    module.createBookingDraftStore();
    expect(property).not.toHaveBeenCalled();
    expect(read).not.toHaveBeenCalled();
  });

  it("store imports, hydrates and clears without browser globals", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();
    const module = await import("@/features/booking/store/bookingDraftStore");
    const store = module.createBookingDraftStore();
    await store.persist.rehydrate();
    expect(store.getState().draft).toBeNull();
    expect(() => {
      store.getState().setDraft(draft);
      store.getState().clearDraft();
    }).not.toThrow();
  });

  it("denied browser storage stays usable in memory and never throws", async () => {
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Denied", "SecurityError");
    });
    const store = createBookingDraftStore();
    expect(() => store.getState().setDraft(draft)).not.toThrow();
    await store.persist.rehydrate();
    expect(store.getState().draft).toEqual(draft);
    expect(() => store.getState().clearDraft()).not.toThrow();
    expect(store.getState().draft).toBeNull();
  });
});
