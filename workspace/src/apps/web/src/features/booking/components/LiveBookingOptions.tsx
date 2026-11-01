import { useState, type ReactElement, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { z } from "zod";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import { keyFor } from "../repositories/backendBookingRepository";
import { useBookingDraftStore } from "../store/bookingDraftStore";
import type { BookingDraft } from "../types/booking";
import { liveApiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";
import { holdSchema } from "@/shared/api/contracts";

import type { SeatLayout } from "../types/seat";

export interface LiveReviewContent {
  layout: SeatLayout;
  routeOptions: ReactNode;
  paymentOptions: ReactNode;
  secondaryAction: ReactNode;
  payLater: boolean;
}

type Options = {
  owner?: string;
  pickupStopId?: string;
  dropoffStopId?: string;
  paymentChannel?: string;
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
          `/api/v1/trips/${draft.tripId}/seat-holds`,
          holdSchema,
          {
            method: "POST",
            idempotencyKey: `web-hold-${current.attempt}`,
            body: current.holdRequest,
          },
        );
        current.holdToken = recovered.holdToken;
        sessionStorage.setItem(
          keyFor(draft.sessionId),
          JSON.stringify(current),
        );
      }
      if (current.holdToken) {
        const path = `/api/v1/seat-holds/${encodeURIComponent(current.holdToken)}`;
        const hold = await liveApiJson(path, holdSchema);
        if (!["ACTIVE", "EXPIRED", "RELEASED"].includes(hold.status))
          throw new Error(
            "Ghế đã được chuyển thành đơn. Vui lòng kiểm tra vé trong tài khoản trước khi tiếp tục.",
          );
        await liveApiJson(path, z.unknown(), {
          method: "DELETE",
          idempotent: true,
        });
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
    if (pending || current.attempt || current.holdToken || current.bookingId)
      return;
    const next = { ...current, ...patch };
    sessionStorage.setItem(keyFor(draft.sessionId), JSON.stringify(next));
    setOptions(next);
  };
  if (query.isError)
    return (
      <ApiFailure error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data) return <p role="status">Đang tải điểm đón/trả…</p>;
  const stops = [...query.data.stops].sort((a, b) => a.sequence - b.sequence);
  const pickup = options.pickupStopId ?? stops.find((s) => s.pickupAllowed)?.id;
  const dropoff =
    options.dropoffStopId ??
    [...stops].reverse().find((s) => s.dropoffAllowed)?.id;
  const locked =
    pending ||
    Boolean(readOptions(draft.sessionId).attempt) ||
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
  const payLater = options.paymentChannel === "PAY_LATER";
  const paymentOptions = (
    <div className="booking-summary__payment-method booking-summary__payment-choice">
      <label htmlFor="review-payment-channel">Hình thức thanh toán</label>
      <select
        id="review-payment-channel"
        disabled={locked}
        value={options.paymentChannel ?? "PREPAID"}
        onChange={(e) => update({ paymentChannel: e.target.value })}
      >
        <option value="PREPAID">Thanh toán trực tuyến</option>
        {query.data.allowPayLater && (
          <option value="PAY_LATER">Thanh toán sau</option>
        )}
      </select>
      <p>
        {payLater
          ? "Thanh toán theo hướng dẫn của nhà xe."
          : "Chọn phương thức VNPay ở bước tiếp theo."}
      </p>
    </div>
  );
  const secondaryAction = (
    <div className="booking-summary__cancel">
      {!draft.bookingId && (
        <Button
          variant="ghost"
          disabled={pending}
          isLoading={release.isPending}
          onClick={() => {
            onReleasePending(true);
            release.mutate();
          }}
        >
          Hủy đặt vé
        </Button>
      )}
      {release.isError && <ApiFailure error={release.error} />}
    </div>
  );
  return children({
    layout: chosenLayout,
    routeOptions,
    paymentOptions,
    secondaryAction,
    payLater,
  });
}
