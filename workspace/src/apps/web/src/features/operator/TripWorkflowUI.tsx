import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Link } from "react-router";
import { ApiError } from "@/shared/api/error";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { vietnamLocal, type Trip, type Route } from "./tripWorkflow";
import back from "@/assets/operator/create/imgIconArrowLeft.svg";
import activeStep from "@/assets/operator/create/imgStep1.svg";
import inactiveStep from "@/assets/operator/create/imgStep2.svg";
import pin from "@/assets/operator/create/imgIconPin.svg";
import "./create/CreateTripPage.css";
import "./review/TripReviewPage.css";
import "./TripWorkflow.css";
export function WorkflowError({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}): ReactElement | null {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) {
      ref.current?.focus();
      ref.current?.scrollIntoView({ block: "nearest" });
    }
  }, [error]);
  if (!error) return null;
  const message =
    error instanceof ApiError && error.code === "SCHEDULE_CONFLICT"
      ? "Xe hoặc tài xế bị trùng lịch. Vui lòng sửa phân công hoặc thời gian rồi kiểm tra lại."
      : error instanceof ApiError && error.code === "VERSION_CONFLICT"
        ? "Bản nháp đã thay đổi ở nơi khác. Tải lại chuyến trước khi tiếp tục."
        : error.message;
  return (
    <div ref={ref} className="operator-trip-workflow__error" tabIndex={-1}>
      <ApiFailure error={new Error(message)} retry={retry} />
    </div>
  );
}
export function TripWorkflowShell({
  title,
  status,
  review = false,
  children,
}: {
  title: string;
  status: string;
  review?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <section className="operator-trip-workflow operator-create">
      <header className="operator-trip-workflow__header">
        <h1>{title}</h1>
        <span role="status" className="operator-create__save-status">
          {status}
        </span>
        <Link className="operator-create__back" to="/operator/trips">
          <img src={back} alt="" width={16} height={16} />
          Lịch chuyến
        </Link>
      </header>
      <ol className="operator-create__steps" aria-label="Các bước tạo chuyến">
        {[
          ["Thông tin chuyến", "Tuyến và thời gian"],
          ["Phân công", "Xe và tài xế"],
          ["Xác nhận", "Kiểm tra và phát hành"],
        ].map(([name, desc], i) => (
          <li
            key={name}
            aria-current={i === (review ? 2 : 0) ? "step" : undefined}
          >
            <span className="operator-create__step-number">
              <img
                src={i === (review ? 2 : 0) ? activeStep : inactiveStep}
                alt=""
                width={32}
                height={32}
              />
              <b>{i + 1}</b>
            </span>
            <div>
              <strong>{name}</strong>
              <small>{desc}</small>
            </div>
          </li>
        ))}
      </ol>
      {children}
    </section>
  );
}
export function TripFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="operator-review__fact">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}
export function TripStops({
  route,
  trip,
}: {
  route?: Route;
  trip?: Trip;
}): ReactElement {
  const stops = trip?.stops ?? route?.stops ?? [];
  return (
    <div className="operator-create__two">
      {[true, false].map((pickup) => (
        <section key={String(pickup)} className="operator-trip-workflow__stops">
          <h3>{pickup ? "Điểm đón" : "Điểm trả"}</h3>
          {stops
            .filter((s) => (pickup ? s.pickupAllowed : s.dropoffAllowed))
            .sort((a, b) => a.sequence - b.sequence)
            .map((s) => (
              <div key={s.id}>
                <img src={pin} alt="" width={17} height={17} />
                <p>
                  <strong>{s.name}</strong>
                  {s.address && <small>{s.address}</small>}
                </p>
              </div>
            ))}
          {!stops.length && <p>Chọn tuyến để xem các điểm dừng.</p>}
        </section>
      ))}
    </div>
  );
}
export function CancellationPolicy(): ReactElement {
  return (
    <>
      <TripFact label="Chính sách hủy">Tiêu chuẩn 24h / 6h / 2h</TripFact>
      {["Từ 24 giờ trở lên", "Từ 6 đến dưới 24 giờ", "Từ 2 đến dưới 6 giờ"].map(
        (text, i) => (
          <div className="operator-create__policy" key={text}>
            <span>{text}</span>
            <strong>Phí hủy {(i + 1) * 10}%</strong>
          </div>
        ),
      )}
      <p>Dưới 2 giờ: không hỗ trợ khách tự hủy vé.</p>
    </>
  );
}
export function PublicTripLink({ trip }: { trip: Trip }): ReactElement {
  return (
    <Link
      className="button button--secondary"
      to={`/trips?${new URLSearchParams({ originId: trip.origin, destinationId: trip.destination, departureDate: vietnamLocal(trip.departureAt).slice(0, 10), passengerCount: "1", organizationId: trip.organizationId })}`}
    >
      Xem chuyến bên khách hàng
    </Link>
  );
}
