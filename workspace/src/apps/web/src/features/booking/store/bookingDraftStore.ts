import {
  create,
  type Mutate,
  type StoreApi,
  type UseBoundStore,
} from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import { z } from "zod";

import { paymentAttemptSchema } from "@/features/payment/schemas/payment.schema";
import { bookingPassengerCountSchema } from "@/features/booking/schemas/passengerCount.schema";
import { bookingAttemptKeySchema } from "@/features/booking/schemas/bookingCreation.schema";
import type {
  BookingDraft,
  ContactDraft,
  PassengerDraft,
} from "@/features/booking/types/booking";

export const BOOKING_DRAFT_STORAGE_KEY = "blue-booking-draft";
export type BookingSessionDraft = Pick<
  BookingDraft,
  "sessionId" | "bookingId" | "expiresAt"
>;

export interface BookingDraftState {
  draft: BookingDraft | null;
  setDraft: (draft: BookingDraft) => void;
  replaceSeats: (seatIds: string[], totalVnd: number) => void;
  setContact: (contact: ContactDraft) => void;
  setPassengers: (passengers: PassengerDraft[]) => void;
  clearDraft: () => void;
}

type BookingDraftStore = UseBoundStore<
  Mutate<
    StoreApi<BookingDraftState>,
    [["zustand/persist", Pick<BookingDraftState, "draft">]]
  >
>;

const draftId = z.string().trim().min(1);
const persistedDraftSchema = z.object({
  draft: z.object({
    sessionId: draftId,
    bookingId: draftId.optional(),
    bookingAttemptKey: bookingAttemptKeySchema.optional(),
    paymentAttempt: paymentAttemptSchema.optional(),
    tripId: draftId,
    passengerCount: bookingPassengerCountSchema,
    selectedSeatIds: z.array(draftId),
    contact: z
      .object({ fullName: z.string(), email: z.string(), phone: z.string() })
      .optional(),
    passengers: z.array(
      z.object({
        seatId: draftId,
        fullName: z.string(),
        phone: z.string().optional(),
      }),
    ),
    expiresAt: z.iso.datetime(),
    totalVnd: z.number().int().nonnegative(),
  }),
});

function readPersistedDraft(
  value: unknown,
  storage: StateStorage,
): BookingDraft | null {
  const parsed = persistedDraftSchema.safeParse(value);
  if (parsed.success && Date.parse(parsed.data.draft.expiresAt) > Date.now())
    return parsed.data.draft;
  void storage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  return null;
}

// Browser storage is resolved only by an explicit hydration or draft action.
const browserStorage: StateStorage = {
  getItem: (name) => {
    try {
      return typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(name);
    } catch {
      return null;
    } // Unreadable storage is an absent local draft.
  },
  setItem: (name, value) => {
    try {
      if (typeof window !== "undefined")
        window.sessionStorage.setItem(name, value);
    } catch {
      /* Storage denial keeps the draft usable in memory for this page. */
    }
  },
  removeItem: (name) => {
    try {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(name);
    } catch {
      /* Unavailable storage cannot be cleared; memory still clears. */
    }
  },
};

function createDraftState(
  set: StoreApi<BookingDraftState>["setState"],
  get: StoreApi<BookingDraftState>["getState"],
  storage: StateStorage,
): BookingDraftState {
  const update = (patch: Partial<BookingDraft>): void => {
    const draft = get().draft;
    if (draft) set({ draft: { ...draft, ...patch } });
  };
  return {
    draft: null,
    setDraft: (draft) =>
      set({ draft: copyDraft(withAttemptKey(draft, get().draft)) }),
    replaceSeats: (seatIds, totalVnd) =>
      update({ selectedSeatIds: [...seatIds], totalVnd }),
    setContact: (contact) => update({ contact: copyContact(contact) }),
    setPassengers: (passengers) =>
      update({ passengers: passengers.map(copyPassenger) }),
    clearDraft: () => {
      set({ draft: null });
      void storage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
    },
  };
}

function copyContact({ fullName, email, phone }: ContactDraft): ContactDraft {
  return { fullName, email, phone };
}

function copyPassenger({
  seatId,
  fullName,
  phone,
}: PassengerDraft): PassengerDraft {
  return { seatId, fullName, ...(phone === undefined ? {} : { phone }) };
}

function copyDraft(draft: BookingDraft): BookingDraft {
  return {
    sessionId: draft.sessionId,
    ...(draft.paymentAttempt
      ? { paymentAttempt: { ...draft.paymentAttempt } }
      : {}),
    ...(draft.bookingId === undefined ? {} : { bookingId: draft.bookingId }),
    ...(draft.bookingAttemptKey === undefined
      ? {}
      : { bookingAttemptKey: draft.bookingAttemptKey }),
    tripId: draft.tripId,
    passengerCount: draft.passengerCount,
    selectedSeatIds: [...draft.selectedSeatIds],
    ...(draft.contact ? { contact: copyContact(draft.contact) } : {}),
    passengers: draft.passengers.map(copyPassenger),
    expiresAt: draft.expiresAt,
    totalVnd: draft.totalVnd,
  };
}
function withAttemptKey(
  draft: BookingDraft,
  current: BookingDraft | null,
): BookingDraft {
  const key =
    draft.bookingAttemptKey ??
    (current?.sessionId === draft.sessionId
      ? current.bookingAttemptKey
      : undefined);
  return key === undefined ? draft : { ...draft, bookingAttemptKey: key };
}

export function createBookingDraftStore(
  storage: StateStorage = browserStorage,
): BookingDraftStore {
  return create<BookingDraftState>()(
    persist((set, get) => createDraftState(set, get, storage), {
      name: BOOKING_DRAFT_STORAGE_KEY,
      storage: createJSONStorage<Pick<BookingDraftState, "draft">>(
        () => storage,
      ),
      partialize: ({ draft }) => ({ draft }),
      skipHydration: true,
      merge: (persisted, current) =>
        persisted === undefined
          ? current
          : { ...current, draft: readPersistedDraft(persisted, storage) },
      onRehydrateStorage: () => (_state, error) => {
        if (error) void storage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
      },
    }),
  );
}

export const useBookingDraftStore = createBookingDraftStore();

export const selectBookingSession = (
  state: BookingDraftState,
): BookingSessionDraft | null => state.draft;
