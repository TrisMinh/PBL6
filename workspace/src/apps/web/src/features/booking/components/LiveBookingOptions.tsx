import { CouponReview } from "./CouponReview";
import type { CouponQuote } from "@/features/trips/api/coupons";
import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useState, type ReactElement, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import {
  cancelLiveSeatSession,
  keyFor,
} from "../repositories/backendBookingRepository";
import { CancelSeatSessionButton } from "./CancelSeatSessionButton";
import { useBookingDraftStore } from "../store/bookingDraftStore";
import type { BookingDraft } from "../types/booking";
import { liveApiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { holdSchema } from "@/shared/api/contracts";

import type { SeatLayout } from "../types/seat";

export interface LiveReviewContent {
  layout: SeatLayout;
  routeOptions: ReactNode;
  paymentOptions: ReactNode;
  secondaryAction: ReactNode;
  payLater: boolean;
  amounts?: { subtotal: number; discount: number; fee: number };
}

type Options = {
  coupon?: CouponQuote;
  couponRejected?: boolean;
  owner?: string;
  pickupStopId?: string;
  dropoffStopId?: string;
  paymentChannel?: string;
  prepaidRequired?: boolean;
  holdToken?: string;
  bookingId?: string;
  attempt?: string;
  holdRequest?: {
    seatIds: string[];
    pickupStopId: string;
    dropoffStopId: string;
  };
};
function readOptions(id: string): Options {
  return JSON.parse(sessionStorage.getItem(keyFor(id)) ?? "{}");
}

export function LiveBookingOptions({
  draft,
  pending,
  onReleasePending,
  layout,
  children,
}: {
  layout: SeatLayout;
  children: (content: LiveReviewContent) => ReactElement;
  draft: BookingDraft;
  pending: boolean;
  onReleasePending: (pending: boolean) => void;
}): ReactElement {
  const navigate = useNavigate();
  const [options, setOptions] = useState(() => readOptions(draft.sessionId));
  const query = useQuery({
    queryKey: liveQueryKey("booking-options", draft.tripId),
    queryFn: ({ signal }) => getBackendTrip(draft.tripId, signal),
  });
  const release = useMutation({
    mutationFn: async () => {
      const current = readOptions(draft.sessionId);
      if (current.bookingId)
        throw new Error(
          "Đơn đã được tạo. Vui lòng quản lý đơn trong tài khoản.",
        );
      if (!current.holdToken && current.attempt && current.holdRequest) {
        const recovered = await liveApiJson(
          `/api/v1/trips/${draft.tripId}/seat-holds/current`,
          holdSchema.optional(),
          { cache: "no-store" },
        );
        current.holdToken = recovered?.holdToken;
      }
      if (current.holdToken) {
        const path = `/api/v1/seat-holds/${encodeURIComponent(current.holdToken)}`;
        const hold = await liveApiJson(path, holdSchema);
        if (!["ACTIVE", "EXPIRED", "RELEASED"].includes(hold.status))
          throw new Error(
            "Ghế đã được chuyển thành đơn. Vui lòng kiểm tra vé trong tài khoản trước khi tiếp tục.",
          );
        await cancelLiveSeatSession(current.holdToken);
      }
      sessionStorage.removeItem(keyFor(draft.sessionId));
      useBookingDraftStore.getState().clearDraft();
      void navigate("/", { replace: true });
    },
    retry: false,
    onSettled: () => onReleasePending(false),
  });
  const update = (patch: Partial<Options>): void => {
    const current = readOptions(draft.sessionId);
    if (
      pending ||
      current.attempt ||
      current.bookingId ||
      (current.holdToken && patch.paymentChannel === undefined)
    )
      return;
    const next = { ...current, ...patch };
    sessionStorage.setItem(keyFor(draft.sessionId), JSON.stringify(next));
    setOptions(next);
  };
  if (query.isError)
    return (
      <ApiFailure error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data)
    return <BrandLoading compact title="Đang tải điểm đón/trả…" />;
  const stops = [...query.data.stops].sort((a, b) => a.sequence - b.sequence);
  const pickup = options.pickupStopId ?? stops.find((s) => s.pickupAllowed)?.id;
  const dropoff =
    options.dropoffStopId ??
    [...stops].reverse().find((s) => s.dropoffAllowed)?.id;
  const locked =
    pending ||
    Boolean(
      readOptions(draft.sessionId).attempt &&
      !readOptions(draft.sessionId).couponRejected,
    ) ||
    release.isPending ||
    Boolean(draft.bookingId);
  const pickupStop = stops.find((stop) => stop.id === pickup);
  const dropoffStop = stops.find((stop) => stop.id === dropoff);
  const chosenLayout: SeatLayout = {
    ...layout,
    trip: {
      ...layout.trip,
      originStopName: pickupStop?.name ?? layout.trip.originStopName,
      destinationStopName: dropoffStop?.name ?? layout.trip.destinationStopName,
      departureTime: new Date(
        Date.parse(query.data.departureAt) +
          (pickupStop?.offsetMinutes ?? 0) * 60000,
      ).toISOString(),
      arrivalTime: dropoffStop
        ? new Date(
            Date.parse(query.data.departureAt) +
              dropoffStop.offsetMinutes * 60000,
          ).toISOString()
        : layout.trip.arrivalTime,
    },
  };
  const routeOptions = (
    <fieldset className="booking-review__route-options" disabled={locked}>
      <legend className="sr-only">Chọn điểm đón và điểm trả</legend>
      <label>
        Điểm đón
        <select
          value={pickup ?? ""}
          onChange={(e) => {
            const selected = stops.find((stop) => stop.id === e.target.value);
            const end = stops.find((stop) => stop.id === dropoff);
            update({
              pickupStopId: e.target.value,
              ...(selected && end && selected.sequence >= end.sequence
                ? {
                    dropoffStopId: stops.find(
                      (stop) =>
                        stop.dropoffAllowed &&
                        stop.sequence > selected.sequence,
                    )?.id,
                  }
                : {}),
            });
          }}
        >
          {stops
            .filter(
              (stop) =>
                stop.pickupAllowed &&
                stops.some(
                  (end) => end.dropoffAllowed && end.sequence > stop.sequence,
                ),
            )
            .map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Điểm trả
        <select
          value={dropoff ?? ""}
          onChange={(e) => update({ dropoffStopId: e.target.value })}
        >
          {stops
            .filter(
              (stop) =>
                stop.dropoffAllowed &&
                stop.sequence > (pickupStop?.sequence ?? -1),
            )
            .map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.name}
              </option>
            ))}
        </select>
      </label>
    </fieldset>
  );
  const prepaidRequired = readOptions(draft.sessionId).prepaidRequired;
  const payLater = !prepaidRequired && options.paymentChannel === "PAY_LATER";
  const paymentOptions = (
    <>
      <CouponReview
        draft={draft}
        coupon={options.coupon}
        locked={locked}
        onPending={onReleasePending}
        onChange={(coupon) => {
          const current = readOptions(draft.sessionId);
          if ((current.attempt && !current.couponRejected) || current.bookingId)
            return;
          const next = {
            ...current,
            coupon,
            couponRejected: false,
            attempt: undefined,
          };
          const activeDraft = useBookingDraftStore.getState().draft;
          if (
            activeDraft?.sessionId === draft.sessionId &&
            current.couponRejected
          )
            useBookingDraftStore.getState().setDraft({
              ...activeDraft,
              bookingAttemptKey: crypto.randomUUID(),
            });
          sessionStorage.setItem(keyFor(draft.sessionId), JSON.stringify(next));
          setOptions(next);
        }}
      />
      <div className="booking-summary__payment-method booking-summary__payment-choice">
        <label htmlFor="review-payment-channel">Hình thức thanh toán</label>
        <select
          id="review-payment-channel"
          disabled={locked}
          value={payLater ? "PAY_LATER" : "PREPAID"}
          onChange={(e) => update({ paymentChannel: e.target.value })}
        >
          <option value="PREPAID">Thanh toán trực tuyến</option>
          {query.data.allowPayLater && !prepaidRequired && (
            <option value="PAY_LATER">Thanh toán sau</option>
          )}
        </select>
        <p>
          {prepaidRequired
            ? "Lượt đặt này cần thanh toán trước."
            : payLater
              ? "Thanh toán theo hướng dẫn của nhà xe."
              : "Bạn sẽ được chuyển sang SePay để thanh toán."}
        </p>
      </div>
    </>
  );
  const secondaryAction = (
    <div className="booking-summary__cancel">
      {!draft.bookingId && (
        <CancelSeatSessionButton
          disabled={pending}
          pending={release.isPending}
          onConfirm={() => {
            onReleasePending(true);
            release.mutate();
          }}
        />
      )}
      {release.isError && <ApiFailure error={release.error} popup />}
    </div>
  );
  return children({
    layout: chosenLayout,
    routeOptions,
    paymentOptions,
    secondaryAction,
    payLater,
    amounts: options.coupon
      ? {
          subtotal: options.coupon.subtotal,
          discount: options.coupon.discount,
          fee: 0,
        }
      : undefined,
  });
}
