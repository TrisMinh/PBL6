import type { ReactElement } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { CreateTripPage, type TripEditorPreview } from "../create/TripEditor";
import {
  type TripForm,
  type Route,
  type Bus,
  type Driver,
} from "../tripWorkflow";
import type { ScheduleTrip } from "./schedule.schema";
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
}: {
  trip: ScheduleTrip;
  historical?: boolean;
  statusLabel?: string;
  onClose: () => void;
  onSaveDemo: (trip: ScheduleTrip) => void;
  onSaved: () => void;
}): ReactElement {
  const demo = trip.id === "DEMO-TAI-XE";
  const status = trip.scheduleStatus ?? trip.status;
  const archived =
    historical || ["completed", "cancelled", "needs_update"].includes(status);
  const summary = !demo && (archived || trip.status !== "draft");
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
                : summary
                  ? "Chi tiết chuyến"
                  : "Chỉnh sửa bản nháp"}
          </Dialog.Title>
          <Dialog.Description id="expanded-trip-description">
            {demo
              ? "DEMO · Dùng cùng form tạo chuyến. Thay đổi chỉ áp dụng cho thẻ minh họa."
              : summary
                ? "Thông tin lịch chạy và phân công đã lưu."
                : "Thông tin, phân công và giá vé của chuyến. Khả năng chỉnh sửa phụ thuộc trạng thái chuyến."}
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
                  trip.driver.name
                    .split(" ")
                    .slice(-2)
                    .map((part) => part[0])
                    .join("")
                )}
              </span>
              <div>
                <small>Tài xế</small>
                <strong>{trip.driver.name}</strong>
              </div>
            </div>
          )}
          {statusLabel && !demo && (
            <OperatorStatusBadge state={status}>
              {statusLabel}
            </OperatorStatusBadge>
          )}
          {!summary && (
            <p className="operator-trip-expanded__scope">
              {demo
                ? "Có thể thử đổi thời gian, xe, tài xế và giá vé ở form bên phải."
                : "Lưu bản nháp sẽ cập nhật vào hệ thống. Chuyến đã phát hành được giữ nguyên thông tin."}
            </p>
          )}
        </aside>
        <div className="operator-trip-expanded__editor">
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
              {status === "needs_update" && (
                <p>
                  Đã qua giờ đến dự kiến. Chuyến đang chờ cập nhật trạng thái
                  vận hành.
                </p>
              )}
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
