import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { getSchedule } from "./scheduleRepository";
import {
  selectSchedule,
  type ScheduleCriteria,
  type ScheduleTrip,
} from "./schedule.schema";
import thumbnail from "@/assets/operator/schedule/imgTripVehicleThumbnail.png";
import demoDriverAvatar from "@/assets/operator/schedule/driver-demo-avatar.svg";
import searchIcon from "@/assets/operator/schedule/imgIconSearch.svg";
import swapIcon from "@/assets/operator/schedule/imgIconSwap.svg";
import filterIcon from "@/assets/operator/schedule/imgIconFilter.svg";
import routeIcon from "@/assets/operator/schedule/imgFrame.svg";
import vehicleIcon from "@/assets/operator/schedule/imgIconVehicle.svg";
import passengerIcon from "@/assets/operator/schedule/imgIconPassenger.svg";
import boardingDot from "@/assets/operator/schedule/imgStatusDot.svg";
import scheduledDot from "@/assets/operator/schedule/imgStatusDot1.svg";
import draftDot from "@/assets/operator/schedule/imgStatusDot2.svg";
import createIcon from "@/assets/operator/schedule/imgIconCalendarPlus.svg";
import "./SchedulePage.css";
import { isMockApi } from "@/shared/api/config";
import { paginationWindow } from "../components/paginationWindow";
import { ExpandedTripPanel } from "./ExpandedTripPanel";
import { DatePicker } from "@/shared/ui/DatePicker/DatePicker";
import * as Dialog from "@radix-ui/react-dialog";
import { SteeringWheel } from "@phosphor-icons/react/dist/csr/SteeringWheel";
import { WorkspaceDialogHeading } from "../organization/WorkspaceDialogHeading";

const CITIES = ["TP.HCM", "Đà Lạt", "Nha Trang", "Phan Thiết"];
const demoDriverTrip: ScheduleTrip = {
  id: "DEMO-TAI-XE",
  origin: "Đà Nẵng",
  destination: "Đà Lạt",
  date: "2026-11-23",
  departure: "21:00",
  arrival: "09:00",
  vehicleLabel: "Xe mẫu · Limousine 22 cabin",
  crew: "Nguyễn Minh Hoàng",
  passengers: 12,
  capacity: 22,
  status: "scheduled",
  assignment: "complete",
  driver: {
    name: "Nguyễn Minh Hoàng",
    license: "GPLX minh họa · Hạng E",
    phone: "Chưa cung cấp · dữ liệu demo",
    expires: "2029-12-31",
  },
};
const STATUS = [
  ["", "Tất cả"],
  ["draft", "Nháp"],
  ["scheduled", "Đã lên lịch"],
  ["boarding", "Đang đón khách"],
  ["departed", "Đã khởi hành"],
  ["completed", "Hoàn thành"],
  ["cancelled", "Đã hủy"],
] as const;
const PERIODS = [
  ["morning", "06:00 — 12:00"],
  ["afternoon", "12:00 — 18:00"],
  ["evening", "18:00 — 24:00"],
] as const;
const ASSIGNMENTS = [
  ["complete", "Đã đủ xe & tài xế"],
  ["missing", "Thiếu phương tiện"],
  ["conflict", "Có xung đột"],
] as const;

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly (readonly [string, string])[];
}): ReactElement {
  return (
    <label className="operator-schedule__query-field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}): ReactElement {
  return (
    <fieldset className="operator-schedule__filter-group">
      <legend>{label}</legend>
      {options.map(([id, text]) => (
        <label
          key={id}
          className={
            value === id
              ? "operator-schedule__choice operator-schedule__choice--selected"
              : "operator-schedule__choice"
          }
        >
          <input
            type="checkbox"
            checked={value === id}
            onChange={() => onChange(value === id ? "" : id)}
          />
          <span>{text}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function ScheduleCard({
  trip,
  onOpen,
  displayCode,
  statusLabel,
  showPassengerCount = true,
}: {
  trip: ScheduleTrip;
  onOpen: () => void;
  displayCode?: string;
  statusLabel?: string;
  showPassengerCount?: boolean;
}): ReactElement {
  const [driverOpen, setDriverOpen] = useState(false);
  const status =
    trip.status === "boarding"
      ? ["ĐÓN KHÁCH", boardingDot]
      : trip.status === "draft"
        ? ["NHÁP CÓ LỖI", draftDot]
        : ["ĐÃ LÊN LỊCH", scheduledDot];
  return (
    <article
      className="operator-schedule__card"
      aria-label={`Chuyến ${trip.id}`}
    >
      <div className="operator-schedule__identity">
        <img
          className="operator-schedule__thumbnail"
          src={thumbnail}
          alt="Xe BLUE minh họa"
          width={120}
          height={84}
        />
        <div>
          <span>MÃ CHUYẾN</span>
          <h3 title={trip.id}>
            {displayCode ??
              (/^[0-9a-f-]{36}$/i.test(trip.id)
                ? `CX-${trip.id.slice(-8).toUpperCase()}`
                : trip.id)}
          </h3>
          <small>{trip.vehicleLabel}</small>
          <time dateTime={trip.date}>
            {trip.date.split("-").reverse().join("/")}
          </time>
        </div>
      </div>
      <div className="operator-schedule__journey">
        <div className="operator-schedule__departure">
          <span>KHỞI HÀNH</span>
          <strong>{trip.departure}</strong>
          <small>{trip.origin}</small>
        </div>
        <div className="operator-schedule__rail">
          <span className="operator-schedule__status">
            <img src={status[1]} alt="" />
            {statusLabel ??
              (trip.status === "cancelled"
                ? "ĐÃ HỦY"
                : trip.status === "completed"
                  ? "HOÀN THÀNH"
                  : trip.status === "departed"
                    ? "ĐÃ KHỞI HÀNH"
                    : status[0])}
          </span>
          <img
            className="operator-schedule__route-art"
            src={routeIcon}
            alt=""
            width={190}
            height={28}
          />
        </div>
        <div className="operator-schedule__arrival">
          <span>ĐẾN</span>
          <strong>{trip.arrival}</strong>
          <small>{trip.destination}</small>
        </div>
        <div className="operator-schedule__crew">
          {trip.driver ? (
            <button
              type="button"
              className="operator-schedule__driver-trigger"
              aria-haspopup="dialog"
              onClick={() => setDriverOpen(true)}
            >
              <span
                className="operator-schedule__driver-avatar"
                aria-hidden="true"
              >
                {trip.id === "DEMO-TAI-XE" || trip.driver.avatarUrl ? (
                  <img src={trip.driver.avatarUrl || demoDriverAvatar} alt="" />
                ) : (
                  trip.driver.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(-2)
                    .map((part) => part[0])
                    .join("")
                )}
              </span>
              <span>{trip.driver.name}</span>
            </button>
          ) : (
            <>
              <img src={vehicleIcon} alt="" width={14} height={14} />
              {trip.crew}
            </>
          )}
        </div>
        <p className="operator-schedule__passengers">
          <img src={passengerIcon} alt="" width={14} height={14} />
          {showPassengerCount
            ? `${trip.passengers}/${trip.capacity} khách`
            : "Xem danh sách hành khách"}
        </p>
      </div>
      <Button
        className={[
          "operator-schedule__detail",
          trip.status === "draft" && "operator-schedule__detail--draft",
        ]
          .filter(Boolean)
          .join(" ")}
        variant={trip.status === "draft" ? "primary" : "secondary"}
        onClick={onOpen}
      >
        {trip.status === "draft" ? "Tiếp tục" : "Chi tiết"}
      </Button>
      <Dialog.Root open={driverOpen} onOpenChange={setDriverOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="operator-schedule__overlay" />
          <Dialog.Content className="operator-schedule__dialog operator-schedule__driver-dialog">
            <WorkspaceDialogHeading>Thông tin tài xế</WorkspaceDialogHeading>
            <Dialog.Description>
              {trip.id === "DEMO-TAI-XE"
                ? "Dữ liệu minh họa, chưa phân công vào chuyến thực tế."
                : "Tài xế được phân công cho chuyến này."}
            </Dialog.Description>
            <div className="operator-schedule__driver-heading">
              <SteeringWheel size={32} weight="duotone" />
              <strong>{trip.driver?.name}</strong>
            </div>
            <dl>
              <div>
                <dt>Giấy phép lái xe</dt>
                <dd>{trip.driver?.license || "Chưa cập nhật"}</dd>
              </div>
              <div>
                <dt>Điện thoại</dt>
                <dd>{trip.driver?.phone || "Chưa cập nhật"}</dd>
              </div>
              <div>
                <dt>Hạn giấy phép</dt>
                <dd>
                  {trip.driver?.expires
                    ? trip.driver.expires.split("-").reverse().join("/")
                    : "Chưa cập nhật"}
                </dd>
              </div>
              <div>
                <dt>Hành trình</dt>
                <dd>
                  {trip.origin} → {trip.destination}
                </dd>
              </div>
            </dl>
            <Dialog.Close asChild>
              <Button variant="secondary">Đóng</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </article>
  );
}

export function SchedulePage(): ReactElement {
  const [expandedTrip, setExpandedTrip] = useState<ScheduleTrip | null>(null);
  const [demoTrip, setDemoTrip] = useState(demoDriverTrip);
  const openDetails = (trip: ScheduleTrip): void => setExpandedTrip(trip);
  const closeDetails = (): void => setExpandedTrip(null);

  const [demoNotice, setDemoNotice] = useState("");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [origin, setOrigin] = useState(
    params.get("origin") ?? (isMockApi ? "TP.HCM" : ""),
  );
  const [destination, setDestination] = useState(
    params.get("destination") ?? (isMockApi ? "Đà Lạt" : ""),
  );
  const [date, setDate] = useState(
    params.get("date") ?? (isMockApi ? "2026-08-28" : ""),
  );
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [period, setPeriod] = useState(
    params.get("period") ?? (isMockApi ? "morning" : ""),
  );
  const [assignment, setAssignment] = useState(
    params.get("assignment") ?? (isMockApi ? "complete" : ""),
  );
  const query = useQuery({
    queryKey: ["operator", "schedule-preview"],
    queryFn: ({ signal }) => getSchedule(signal),
  });
  const criteria: ScheduleCriteria = Object.fromEntries(params);
  const trips = selectSchedule(query.data ?? [], criteria);
  const cities = isMockApi
    ? CITIES
    : [
        ...new Set(
          (query.data ?? []).flatMap((t) => [t.origin, t.destination]),
        ),
      ].sort((a, b) => a.localeCompare(b, "vi"));
  const pages = Math.max(1, Math.ceil(trips.length / 5));
  const requestedPage = Number(params.get("page") ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0
      ? Math.min(pages, requestedPage)
      : 1;
  const update = (patch: Record<string, string>): void => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("page");
      for (const [key, value] of Object.entries(patch)) {
        next.delete(key);
        if (value) next.set(key, value);
      }
      return next;
    });
  };
  const search = (event: FormEvent): void => {
    event.preventDefault();
    update({ origin, destination, date, status });
  };
  const reset = (): void => {
    setOrigin(isMockApi ? "TP.HCM" : "");
    setDestination(isMockApi ? "Đà Lạt" : "");
    setDate(isMockApi ? "2026-08-28" : "");
    setStatus("");
    setPeriod(isMockApi ? "morning" : "");
    setAssignment(isMockApi ? "complete" : "");
    setParams({});
  };
  const changePage = (value: number): void => {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value === 1) next.delete("page");
      else next.set("page", String(value));
      return next;
    });
  };
  return (
    <div className="operator-schedule">
      <a className="operator-schedule__skip" href="#operator-schedule-main">
        Đến lịch chuyến
      </a>
      <OperatorSidebar />
      <main id="operator-schedule-main" className="operator-schedule__main">
        <section
          className="operator-schedule__search-panel"
          aria-label="Tìm kiếm lịch chuyến"
        >
          <header className="operator-schedule__header">
            <div>
              <h1>Lịch chuyến</h1>
              <p className="operator-schedule__description">
                Tìm theo hành trình, ngày chạy và trạng thái chuyến.
              </p>
            </div>
            <Button onClick={() => void navigate("/operator/trips/new")}>
              <img src={createIcon} alt="" width={18} height={18} />
              Tạo chuyến mới
            </Button>
          </header>
          <form className="operator-schedule__query" onSubmit={search}>
            <SelectField
              label="Điểm đi"
              value={origin}
              onChange={setOrigin}
              options={[
                ["", "Tất cả"],
                ...cities.map((city): [string, string] => [city, city]),
              ]}
            />
            <button
              className="operator-schedule__swap"
              type="button"
              aria-label="Đổi chiều hành trình"
              onClick={() => {
                setOrigin(destination);
                setDestination(origin);
              }}
            >
              <img src={swapIcon} alt="" width={16} height={16} />
            </button>
            <SelectField
              label="Điểm đến"
              value={destination}
              onChange={setDestination}
              options={[
                ["", "Tất cả"],
                ...cities.map((city): [string, string] => [city, city]),
              ]}
            />
            <label className="operator-schedule__query-field">
              <span>Ngày chạy</span>
              <DatePicker
                aria-label="Ngày chạy"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <SelectField
              label="Trạng thái"
              value={status}
              onChange={setStatus}
              options={STATUS}
            />
            <Button type="submit">
              <img src={searchIcon} alt="" width={18} height={18} />
              Tìm chuyến
            </Button>
          </form>
        </section>
        <div className="operator-schedule__body">
          <aside
            className="operator-schedule__filters"
            aria-label="Bộ lọc lịch chuyến"
          >
            <div className="operator-schedule__filter-heading">
              <h2>Bộ lọc</h2>
              <button type="button" onClick={reset}>
                Đặt lại
              </button>
            </div>
            <FilterGroup
              label="Trạng thái"
              value={status}
              onChange={setStatus}
              options={STATUS}
            />
            <FilterGroup
              label="Khung giờ"
              value={period}
              onChange={setPeriod}
              options={PERIODS}
            />
            <FilterGroup
              label="Phân công"
              value={assignment}
              onChange={setAssignment}
              options={ASSIGNMENTS}
            />
            <Button
              className="operator-schedule__apply"
              onClick={() => update({ status, period, assignment })}
            >
              <img src={filterIcon} alt="" width={16} height={16} />
              Áp dụng bộ lọc
            </Button>
          </aside>
          <section
            className="operator-schedule__results"
            aria-labelledby="schedule-results-title"
          >
            <div className="operator-schedule__results-heading">
              <h2 id="schedule-results-title">Lịch chuyến</h2>
              <span role="status">{trips.length} kết quả</span>
              <select
                aria-label="Sắp xếp lịch chuyến"
                value={params.get("sort") ?? "reference"}
                onChange={(event) => update({ sort: event.target.value })}
              >
                <option value="reference">Thứ tự mẫu</option>
                <option value="earliest">Giờ khởi hành tăng dần</option>
                <option value="latest">Giờ khởi hành giảm dần</option>
              </select>
            </div>
            <details className="operator-schedule__driver-demo" open>
              <summary>
                Ví dụ chuyến có tài xế <span>DEMO</span>
              </summary>
              <ScheduleCard
                trip={demoTrip}
                displayCode="CHUYẾN MINH HỌA"
                onOpen={() => openDetails(demoTrip)}
              />
            </details>
            <Dialog.Root
              open={expandedTrip !== null}
              onOpenChange={(open) => {
                if (!open) closeDetails();
              }}
            >
              <Dialog.Portal>
                <Dialog.Overlay className="operator-schedule__overlay" />
                {expandedTrip && (
                  <ExpandedTripPanel
                    trip={expandedTrip}
                    onClose={closeDetails}
                    onSaved={() => {
                      void query.refetch();
                      closeDetails();
                    }}
                    onSaveDemo={(value) => {
                      setDemoTrip(value);
                      closeDetails();
                      setDemoNotice(
                        "Đã cập nhật chuyến minh họa. Dữ liệu chuyến thật không thay đổi.",
                      );
                    }}
                  />
                )}
              </Dialog.Portal>
            </Dialog.Root>
            {demoNotice && (
              <p className="operator-schedule__demo-notice" role="status">
                {demoNotice}
              </p>
            )}
            {query.isPending ? (
              <BrandLoading compact title="Đang tải lịch chuyến…" />
            ) : query.isError ? (
              <PageState
                title="Chưa tải được lịch chuyến"
                description="Kiểm tra kết nối và thử lại."
                action={
                  <Button onClick={() => void query.refetch()}>Thử lại</Button>
                }
              />
            ) : !trips.length ? (
              <PageState
                title="Không có chuyến phù hợp"
                description="Thử đổi hành trình hoặc đặt lại bộ lọc."
                action={<Button onClick={reset}>Đặt lại bộ lọc</Button>}
              />
            ) : (
              <div className="operator-schedule__cards">
                {trips.slice((page - 1) * 5, page * 5).map((trip) => (
                  <ScheduleCard
                    key={trip.id}
                    trip={trip}
                    onOpen={() => openDetails(trip)}
                  />
                ))}
              </div>
            )}
            <footer className="operator-schedule__footer">
              <p>
                Hiển thị {trips.length ? (page - 1) * 5 + 1 : 0}–
                {Math.min(page * 5, trips.length)} trong {trips.length} chuyến
              </p>
              <nav aria-label="Phân trang lịch chuyến">
                <button
                  aria-label="Trang trước"
                  disabled={page === 1}
                  onClick={() => changePage(page - 1)}
                >
                  ‹
                </button>
                {paginationWindow(page, pages).map((number) =>
                  typeof number === "string" ? (
                    <span key={number} aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={number}
                      aria-label={`Trang ${number}`}
                      aria-current={page === number ? "page" : undefined}
                      onClick={() => changePage(number)}
                    >
                      {number}
                    </button>
                  ),
                )}
                <button
                  aria-label="Trang sau"
                  disabled={page === pages}
                  onClick={() => changePage(page + 1)}
                >
                  ›
                </button>
              </nav>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}
