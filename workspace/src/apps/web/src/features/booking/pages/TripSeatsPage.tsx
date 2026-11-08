import { useEffect, type ReactElement } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { z } from "zod";

import { TripUnavailableState } from "../components/TripUnavailableState";
import { useCreateBookingSession } from "../hooks/useCreateBookingSession";
import { isMockApi } from "@/shared/api/config";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

function StartTripBooking({
  tripId,
  passengerCount,
}: {
  tripId: string;
  passengerCount: number;
}): ReactElement {
  const { createSession, error, isPending, retry } = useCreateBookingSession({
    replace: true,
  });
  useEffect(() => {
    createSession(tripId, passengerCount);
  }, [createSession, tripId, passengerCount]);

  if (error?.code === "TRIP_NOT_SELLABLE") return <TripUnavailableState />;
  if (error) {
    const missing = error.status === 404 || error.code === "NOT_FOUND";
    return (
      <PageState
        title={
          missing ? "Không tìm thấy chuyến" : "Không thể mở trang chọn ghế"
        }
        description={
          missing
            ? "Chuyến này không tồn tại. Vui lòng tìm chuyến khác."
            : "Chưa thể kiểm tra chuyến. Vui lòng thử lại hoặc tìm chuyến khác."
        }
        action={
          <>
            {error.canRetry && (
              <Button type="button" onClick={retry} isLoading={isPending}>
                Thử lại
              </Button>
            )}
            <Link to={ROUTES.home}>Tìm chuyến khác</Link>
          </>
        }
      />
    );
  }
  return (
    <section>
      <h1>Chọn ghế</h1>
      <p role="status">Đang kiểm tra chuyến…</p>
    </section>
  );
}

/** A shareable trip link; booking-session URLs still belong to one browser. */
export function TripSeatsPage(): ReactElement {
  const { tripId } = useParams();
  const [params] = useSearchParams();
  const count = params.get("passengerCount") ?? "1";
  if (!tripId || (!isMockApi && !z.uuid().safeParse(tripId).success))
    return (
      <PageState
        title="Không tìm thấy chuyến"
        description="Đường dẫn chuyến không hợp lệ. Vui lòng tìm chuyến khác."
        action={<Link to={ROUTES.home}>Tìm chuyến khác</Link>}
      />
    );
  if (!/^[1-6]$/.test(count) || params.getAll("passengerCount").length > 1)
    return (
      <PageState
        title="Số hành khách không hợp lệ"
        description="Vui lòng chọn từ 1 đến 6 hành khách rồi tìm lại chuyến."
        action={<Link to={ROUTES.home}>Tìm chuyến khác</Link>}
      />
    );
  return (
    <StartTripBooking
      key={`${tripId}:${count}`}
      tripId={tripId}
      passengerCount={Number(count)}
    />
  );
}
