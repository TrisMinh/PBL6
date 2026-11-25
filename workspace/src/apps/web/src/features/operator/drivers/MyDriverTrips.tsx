import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";
import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { OperatorStatusBadge } from "../components/OperatorStatusBadge";
import { LiveTripTransition } from "../LiveOperatorForms";
import { tripOperationSteps } from "../tripWorkflow";
import {
  driverTripCode,
  driverTripStatus,
  driverTripTime,
  getDriverTripWork,
  type DriverTripWork,
} from "./driverTripWork";
import "./MyDriverTrips.css";
import { DriverPasswordDialog } from "./DriverPasswordDialog";

const tabs = [
  { id: "now", label: "Đang phụ trách" },
  { id: "next", label: "Sắp chạy" },
  { id: "history", label: "Lịch sử" },
] as const;
type Tab = (typeof tabs)[number]["id"];

function TripCard({
  trip,
  checkedAt,
}: {
  trip: DriverTripWork;
  checkedAt: number;
}): ReactElement {
  const canUpdate =
    trip.phase !== "HISTORY" &&
    Date.parse(trip.departureAt) <= checkedAt + 60 * 60_000;
  const current = tripOperationSteps.findIndex(
    (step) => step.status === trip.status,
  );
  return (
    <article className="driver-trip">
      <div className="driver-trip__heading">
        <div>
          <small>{driverTripCode(trip)}</small>
          <h2>
            {trip.origin} → {trip.destination}
          </h2>
        </div>
        <OperatorStatusBadge
          state={trip.phase === "PENDING" ? "awaiting_departure" : trip.status}
        >
          {driverTripStatus(trip)}
        </OperatorStatusBadge>
      </div>
      <dl className="driver-trip__details">
        <div>
          <dt>Xe được giao</dt>
          <dd>{trip.plateNumber}</dd>
        </div>
        <div>
          <dt>Khởi hành</dt>
          <dd>{driverTripTime(trip.departureAt)}</dd>
        </div>
        <div>
          <dt>Đến dự kiến</dt>
          <dd>{driverTripTime(trip.arrivalAt)}</dd>
        </div>
      </dl>
      {trip.needsUpdate && (
        <p className="driver-trip__notice">
          Đã quá giờ đến dự kiến. Xác nhận theo tình trạng thực tế.
        </p>
      )}
      {current >= 0 && trip.phase !== "HISTORY" && (
        <ol className="driver-trip__progress" aria-label="Tiến trình chuyến">
          {tripOperationSteps.map((step, index) => (
            <li
              key={step.status}
              aria-current={current === index ? "step" : undefined}
            >
              {step.label}
            </li>
          ))}
        </ol>
      )}
      {canUpdate && (
        <div className="driver-trip__action">
          <LiveTripTransition
            showAction
            trip={{
              id: trip.tripId,
              status: trip.status,
              rowVersion: trip.rowVersion,
            }}
          />
        </div>
      )}
    </article>
  );
}

export function MyDriverTrips(): ReactElement {
  const { revoke } = useAccountSession();
  const [selected, setSelected] = useState<Tab | null>(null);
  const query = useQuery({
    queryKey: liveQueryKey("driver-trip-work"),
    queryFn: ({ signal }) => getDriverTripWork(true, signal),
    refetchInterval: 30_000,
    retry: false,
  });
  const trips = query.data ?? [];
  const groups = {
    now: trips.filter(
      (trip) => trip.phase === "OPERATING" || trip.phase === "PENDING",
    ),
    next: trips.filter((trip) => trip.phase === "UPCOMING"),
    history: trips.filter((trip) => trip.phase === "HISTORY"),
  };
  const active = selected ?? (groups.now.length ? "now" : "next");

  return (
    <main className="driver-trip-workspace">
      <header className="driver-trip-workspace__header">
        <BrandLogo placement="header" />
        <div className="driver-password__actions">
          <DriverPasswordDialog onChanged={revoke} />
          <Button variant="ghost" onClick={revoke}>
            Đăng xuất
          </Button>
        </div>
      </header>
      <h1>Chuyến của tôi</h1>
      {query.isPending ? (
        <BrandLoading compact title="Đang tải chuyến được phân công" />
      ) : query.isError ? (
        <PageState
          title="Không tải được chuyến"
          description="Lịch chuyến chỉ dành cho tài khoản tài xế của nhà xe."
          action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
        />
      ) : (
        <>
          <nav className="driver-trip-workspace__tabs" aria-label="Nhóm chuyến">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant="ghost"
                aria-pressed={tab.id === active}
                onClick={() => setSelected(tab.id)}
              >
                {tab.label} <span>{groups[tab.id].length}</span>
              </Button>
            ))}
          </nav>
          {groups[active].length ? (
            groups[active].map((trip) => (
              <TripCard
                key={trip.tripId}
                trip={trip}
                checkedAt={query.dataUpdatedAt}
              />
            ))
          ) : (
            <PageState
              title="Không có chuyến trong mục này"
              description="Chọn mục khác để xem lịch được phân công."
            />
          )}
        </>
      )}
    </main>
  );
}
