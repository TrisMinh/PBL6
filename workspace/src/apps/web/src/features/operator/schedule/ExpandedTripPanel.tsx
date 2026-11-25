import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { LockSimple } from "@phosphor-icons/react/dist/csr/LockSimple";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { getDrivers } from "../drivers/driversRepository";
import { CreateTripPage, type TripEditorPreview } from "../create/TripEditor";
import {
  canOperateTrip,
  tripOperationSteps,
  type TripForm,
  type Route,
  type Bus,
  type Driver,
} from "../tripWorkflow";
import { scheduleTripSchema, type ScheduleTrip } from "./schedule.schema";
import { LiveTripTransition } from "../LiveOperatorForms";
import { TripArtwork } from "../components/TripArtwork";
import { OperatorStatusBadge } from "../components/OperatorStatusBadge";
import demoAvatar from "@/assets/operator/schedule/driver-demo-avatar.svg";
import "./ExpandedTripPanel.css";

const routes: Route[] = [
  {
    id: "demo-route",
    name: "Đà Nẵng → Đà Lạt",
    origin: "Đà Nẵng",
    destination: "Đà Lạt",
    status: "ACTIVE",
    durationMinutes: 720,
    stops: [
      {
        id: "demo-pickup",
        name: "Bến xe Đà Nẵng",
        address: "Điểm đón minh họa tại Đà Nẵng",
        sequence: 0,
        offsetMinutes: 0,
        pickupAllowed: true,
        dropoffAllowed: false,
      },
      {
        id: "demo-dropoff",
        name: "Bến xe Đà Lạt",
        address: "Điểm trả minh họa tại Đà Lạt",
        sequence: 1,
        offsetMinutes: 720,
        pickupAllowed: false,
        dropoffAllowed: true,
      },
    ],
  },
];
const buses: Bus[] = [22, 34].map((count) => ({
  id: `demo-bus-${count}`,
  plateNumber: `Xe mẫu ${count} chỗ`,
  type: count === 22 ? "CABIN_22" : "SLEEPER_34",
  status: "ACTIVE",
  seats: Array.from({ length: count }, (_, i) => ({
    code: `A${i + 1}`,
    enabled: true,
  })),
}));
const drivers: Driver[] = ["Nguyễn Minh Hoàng", "Trần Văn Nam"].map(
  (name, i) => ({
    id: `demo-driver-${i}`,
    userId: `demo-user-${i}`,
    fullName: name,
    licenseNumber: `DEMO-00${i + 1}`,
    licenseExpiresOn: "2030-12-31",
    status: "ACTIVE",
  }),
);

export function ExpandedTripPanel({
  trip,
  historical,
  statusLabel,
  onClose,
  onSaveDemo,
  onSaved,
  onTripTransition,
}: {
  trip: ScheduleTrip;
  historical?: boolean;
  statusLabel?: string;
  onClose: () => void;
  onSaveDemo: (trip: ScheduleTrip) => void;
  onSaved: () => void;
  onTripTransition: (trip: ScheduleTrip) => void;
}): ReactElement {
  const demo = trip.id === "DEMO-TAI-XE";
  const status = trip.scheduleStatus ?? trip.status;
  const archived =
    historical || ["completed", "cancelled", "needs_update"].includes(status);
  const summary = !demo && archived;
  const draft = trip.status === "draft";
  const currentStep = tripOperationSteps.findIndex(
    (step) => step.status === trip.status.toUpperCase(),
  );
  const statusNote =
    status === "awaiting_departure"
      ? "Đã đóng bán vé · Chờ xác nhận khởi hành"
      : status === "needs_update"
        ? "Quá giờ đến · Chờ xác nhận"
        : undefined;
  const canAdvance =
    !demo &&
    !draft &&
    trip.status !== "completed" &&
    trip.status !== "cancelled" &&
    trip.rowVersion !== undefined &&
    canOperateTrip();
  const driverId = trip.driver?.id;
  const driverProfiles = useQuery({
    queryKey: liveQueryKey("operator-driver-profiles"),
    queryFn: ({ signal }) => getDrivers(signal),
    enabled: !demo && !!driverId,
    staleTime: 30_000,
  });
  const driverName =
    driverProfiles.data?.find((driver) => driver.id === driverId)?.name ??
    trip.driver?.name;
  const arrivalDate = new Date(`${trip.date}T00:00:00Z`);
  if (trip.arrival <= trip.departure)
    arrivalDate.setUTCDate(arrivalDate.getUTCDate() + 1);
  const preview: TripEditorPreview | undefined = demo
    ? {
        initialForm: {
          routeId: "demo-route",
          busId: `demo-bus-${trip.capacity}`,
          driverId:
            drivers.find((d) => d.fullName === trip.driver?.name)?.id ??
            "demo-driver-0",
          departureAt: `${trip.date}T${trip.departure}`,
          arrivalAt: `${arrivalDate.toISOString().slice(0, 10)}T${trip.arrival}`,
          fare: trip.fare ? String(trip.fare) : "350000",
        },
        routes,
        buses,
        drivers,
        onSave: (form: TripForm) => {
          const bus = buses.find((b) => b.id === form.busId),
            driver = drivers.find((d) => d.id === form.driverId);
          onSaveDemo({
            ...trip,
            date: form.departureAt.slice(0, 10),
            departure: form.departureAt.slice(11, 16),
            arrival: form.arrivalAt.slice(11, 16),
            vehicleLabel: bus?.plateNumber ?? trip.vehicleLabel,
            capacity: bus?.seats.length ?? trip.capacity,
            crew: driver?.fullName ?? trip.crew,
            fare: Number(form.fare),
            driver: {
              name: driver?.fullName ?? trip.crew,
              license: driver?.licenseNumber ?? "",
              expires: driver?.licenseExpiresOn ?? "",
              phone: "Dữ liệu minh họa",
              avatarUrl: demoAvatar,
            },
          });
        },
      }
    : undefined;
  return (
    <Dialog.Content
      className="operator-trip-expanded"
      onEscapeKeyDown={(event) => {
        const calendar = document.querySelector<HTMLElement>(
          ".date-picker__popup:popover-open",
        );
        if (calendar) {
          event.preventDefault();
          calendar.hidePopover();
        }
      }}
      aria-describedby="expanded-trip-description"
    >
      <header className="operator-trip-expanded__header">
        <div>
          <Dialog.Title>
            {demo
              ? "Chỉnh sửa chuyến minh họa"
              : archived
                ? "Chi tiết lịch sử chuyến"
                : draft
                  ? "Chỉnh sửa bản nháp"
                  : "Chi tiết chuyến"}
          </Dialog.Title>
          <Dialog.Description id="expanded-trip-description">
            {demo
              ? "DEMO · Dùng cùng form tạo chuyến. Thay đổi chỉ áp dụng cho thẻ minh họa."
              : draft
                ? "Cập nhật lịch chạy và phân công."
                : "Lịch chạy và phân công đã lưu."}
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button variant="ghost" aria-label="Đóng chi tiết chuyến">
            <X size={22} />
          </Button>
        </Dialog.Close>
      </header>
      <div className="operator-trip-expanded__body">
        <aside className="operator-trip-expanded__identity">
          <TripArtwork
            className="operator-trip-expanded__photo"
            photo={trip.photo}
            alt="Xe của chuyến"
          />
          <span className="operator-trip-expanded__code">
            {demo ? "CHUYẾN MINH HỌA" : `CX-${trip.id.slice(-8).toUpperCase()}`}
          </span>
          <h3>
            {trip.origin} → {trip.destination}
          </h3>
          <p>
            {trip.departure} · {trip.date.split("-").reverse().join("/")}
          </p>
          <p>{trip.vehicleLabel}</p>
          {!demo && (
            <details className="operator-trip-expanded__technical">
              <summary>Mã định danh hệ thống</summary>
              <code>{trip.id}</code>
            </details>
          )}
          {trip.driver && (
            <div className="operator-trip-expanded__driver">
              <span className="operator-schedule__driver-avatar">
                {demo || trip.driver.avatarUrl ? (
                  <img src={trip.driver.avatarUrl || demoAvatar} alt="" />
                ) : (
                  (driverName ?? "Tài xế")
                    .split(" ")
                    .slice(-2)
                    .map((part) => part[0])
                    .join("")
                )}
              </span>
              <div>
                <small>Tài xế</small>
                <strong>{driverName}</strong>
              </div>
            </div>
          )}
          {statusLabel && !demo && (
            <OperatorStatusBadge state={status}>
              {statusLabel}
            </OperatorStatusBadge>
          )}
          {!summary && (demo || draft) && (
            <p className="operator-trip-expanded__scope">
              {demo
                ? "Có thể thử đổi thời gian, xe, tài xế và giá vé ở form bên phải."
                : "Lưu bản nháp sẽ cập nhật vào hệ thống. Chuyến đã phát hành được giữ nguyên thông tin."}
            </p>
          )}
        </aside>
        <div className="operator-trip-expanded__editor">
          {!demo && currentStep >= 0 && (
            <section
              className="operator-trip-expanded__operations"
              aria-labelledby="trip-operation-title"
            >
              <div className="operator-trip-expanded__operations-header">
                <h3 id="trip-operation-title">Trạng thái vận hành</h3>
                <span className="operator-trip-expanded__read-only">
                  <LockSimple size={14} aria-hidden="true" />
                  Lịch chuyến chỉ xem
                </span>
              </div>
              <div className="operator-trip-expanded__operations-line">
                <ol
                  className="operator-trip-expanded__steps"
                  aria-label="Tiến trình chuyến"
                >
                  {tripOperationSteps.map((step, index) => (
                    <li
                      key={step.status}
                      aria-current={index === currentStep ? "step" : undefined}
                      data-step={index < currentStep ? "past" : undefined}
                    >
                      {index < currentStep ? (
                        <Check size={13} aria-hidden="true" />
                      ) : (
                        <span
                          className="operator-trip-expanded__step-dot"
                          aria-hidden="true"
                        />
                      )}
                      {step.label}
                    </li>
                  ))}
                </ol>
                {canAdvance && (
                  <LiveTripTransition
                    showAction
                    trip={{
                      id: trip.id,
                      status: trip.status.toUpperCase(),
                      rowVersion: trip.rowVersion,
                    }}
                    onTransition={(updated) => {
                      const next = scheduleTripSchema.shape.status.safeParse(
                        typeof updated.status === "string"
                          ? updated.status.toLowerCase()
                          : undefined,
                      );
                      if (
                        !next.success ||
                        typeof updated.rowVersion !== "number"
                      )
                        return;
                      onTripTransition({
                        ...trip,
                        rowVersion: updated.rowVersion,
                        status: next.data,
                        scheduleStatus:
                          status === "needs_update" && next.data !== "arrived"
                            ? "needs_update"
                            : next.data,
                      });
                    }}
                  />
                )}
              </div>
              {statusNote && (
                <p className="operator-trip-expanded__status-note">
                  {statusNote}
                </p>
              )}
            </section>
          )}
          {summary ? (
            <section className="operator-trip-expanded__history">
              <h3>Thông tin chuyến</h3>
              <dl>
                <div>
                  <dt>Khởi hành</dt>
                  <dd>
                    {trip.departure} ·{" "}
                    {trip.date.split("-").reverse().join("/")}
                  </dd>
                </div>
                <div>
                  <dt>Đến dự kiến</dt>
                  <dd>
                    {trip.arrival} ·{" "}
                    {(trip.arrivalDate ?? trip.date)
                      .split("-")
                      .reverse()
                      .join("/")}
                  </dd>
                </div>
                <div>
                  <dt>Điểm đón</dt>
                  <dd>{trip.pickupStops?.join(" · ") || trip.origin}</dd>
                </div>
                <div>
                  <dt>Điểm trả</dt>
                  <dd>{trip.dropoffStops?.join(" · ") || trip.destination}</dd>
                </div>
                <div>
                  <dt>Sức chứa</dt>
                  <dd>{trip.capacity} ghế</dd>
                </div>
                {trip.fare && (
                  <div>
                    <dt>Giá vé</dt>
                    <dd>{formatCurrencyVnd(trip.fare)}</dd>
                  </div>
                )}
              </dl>
            </section>
          ) : (
            <CreateTripPage
              key={trip.id}
              mode={demo ? "create" : "edit"}
              preview={preview}
              embedded
              tripIdOverride={demo ? undefined : trip.id}
              onSaved={onSaved}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </Dialog.Content>
  );
}
