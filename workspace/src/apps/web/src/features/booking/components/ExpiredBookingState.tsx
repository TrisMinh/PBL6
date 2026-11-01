import { useEffect, type ReactElement } from "react";
import { Link } from "react-router";

import { releaseExpiredSeats } from "@/features/booking/hooks/useBookingExpiry";
import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { parseTripSearch } from "@/features/trips/lib/tripResults";
import { ROUTES } from "@/shared/config/routes";
import { PageState } from "@/shared/ui/PageState/PageState";

function recoveryPath(params: URLSearchParams): string {
  const search = parseTripSearch(params);
  if (!search) return ROUTES.home;
  return `${ROUTES.trips}?${new URLSearchParams({ originId: search.originId, destinationId: search.destinationId, departureDate: search.departureDate, passengerCount: String(search.passengerCount), sort: search.sort })}`;
}
export function ExpiredBookingState({
  params,
}: {
  params: URLSearchParams;
}): ReactElement {
  useEffect(() => {
    const draft = useBookingDraftStore.getState().draft;
    if (draft) {
      releaseExpiredSeats(draft.tripId);
      useBookingDraftStore.getState().clearDraft();
    }
  }, []);
  return (
    <PageState
      title="Phiên giữ chỗ đã hết hạn"
      description="Ghế đã được trả lại để hành khách khác có thể chọn. Vui lòng tìm lại chuyến và chọn ghế mới."
      action={
        <Link className="trip-results__edit" to={recoveryPath(params)}>
          Tìm lại chuyến
        </Link>
      }
    />
  );
}
