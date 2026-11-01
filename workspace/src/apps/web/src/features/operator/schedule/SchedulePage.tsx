import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ReactElement, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { getSchedule } from "./scheduleRepository";
import {
  selectSchedule,
  type ScheduleCriteria,
  type ScheduleTrip,
} from "./schedule.schema";
import thumbnail from "@/assets/operator/schedule/imgTripVehicleThumbnail.png";
import searchIcon from "@/assets/operator/schedule/imgIconSearch.svg";
import swapIcon from "@/assets/operator/schedule/imgIconSwap.svg";
import filterIcon from "@/assets/operator/schedule/imgIconFilter.svg";
import routeIcon from "@/assets/operator/schedule/imgFrame.svg";
import vehicleIcon from "@/assets/operator/schedule/imgIconVehicle.svg";
import passengerIcon from "@/assets/operator/schedule/imgIconPassenger.svg";
import boardingDot from "@/assets/operator/schedule/imgStatusDot.svg";
import scheduledDot from "@/assets/operator/schedule/imgStatusDot1.svg";
import draftDot from "@/assets/operator/schedule/imgStatusDot2.svg";
import tripsIcon from "@/assets/operator/schedule/imgFrame1.svg";
import bookingsIcon from "@/assets/operator/schedule/imgFrame2.svg";
import routesIcon from "@/assets/operator/schedule/imgFrame3.svg";
import seatsIcon from "@/assets/operator/schedule/imgFrame4.svg";
import driversIcon from "@/assets/operator/schedule/imgFrame5.svg";
import reportsIcon from "@/assets/operator/schedule/imgFrame6.svg";
import membersIcon from "@/assets/operator/schedule/imgFrame7.svg";
import cancellationsIcon from "@/assets/operator/schedule/imgFrame8.svg";
import createIcon from "@/assets/operator/schedule/imgIconCalendarPlus.svg";
import "./SchedulePage.css";

const CITIES = ["TP.HCM", "Đà Lạt", "Nha Trang", "Phan Thiết"];
const STATUS = [
  ["", "Tất cả"],
  ["draft", "Nháp"],
  ["scheduled", "Đã lên lịch"],
  ["boarding", "Đang đón khách"],
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
const GROUPS = [
  {
    title: "VẬN HÀNH",
    links: [
      ["Chuyến đi", tripsIcon],
      ["Đặt chỗ & giao dịch", bookingsIcon],
      ["Hủy vé & hoàn tiền", cancellationsIcon],
    ],
  },
  {
    title: "TÀI NGUYÊN",
    links: [
      ["Tuyến & điểm dừng", routesIcon],
      ["Xe & sơ đồ ghế", seatsIcon],
      ["Tài xế", driversIcon],
    ],
  },
  {
    title: "QUẢN TRỊ",
    links: [
      ["Báo cáo", reportsIcon],
      ["Tổ chức & thành viên", membersIcon],
    ],
  },
];

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
          <h3>{displayCode ?? trip.id}</h3>
          <small>{trip.vehicleLabel}</small>
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
            {statusLabel ?? status[0]}
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
        <p className="operator-schedule__crew">
          <img src={vehicleIcon} alt="" width={14} height={14} />
          {trip.crew}
        </p>
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
    </article>
  );
}

export function SchedulePage(): ReactElement {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [origin, setOrigin] = useState(params.get("origin") ?? "TP.HCM");
  const [destination, setDestination] = useState(
    params.get("destination") ?? "Đà Lạt",
  );
  const [date, setDate] = useState(params.get("date") ?? "2026-08-28");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [period, setPeriod] = useState(params.get("period") ?? "morning");
  const [assignment, setAssignment] = useState(
    params.get("assignment") ?? "complete",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const lastTrigger = useRef<HTMLElement | null>(null);
  const query = useQuery({
    queryKey: ["operator", "schedule-preview"],
    queryFn: ({ signal }) => getSchedule(signal),
  });
  const criteria: ScheduleCriteria = Object.fromEntries(params);
  const trips = selectSchedule(query.data ?? [], criteria);
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
    setOrigin("TP.HCM");
    setDestination("Đà Lạt");
    setDate("2026-08-28");
    setStatus("");
    setPeriod("morning");
    setAssignment("complete");
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
  const unavailable = (label: string): void => {
    lastTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setNotice(
      `${label} thuộc màn Operator khác và chưa được triển khai trong bản xem trước này.`,
    );
  };
  return (
    <div className="operator-schedule">
      <a className="operator-schedule__skip" href="#operator-schedule-main">
        Đến lịch chuyến
      </a>
      <aside
        className="operator-schedule__sidebar"
        aria-label="Điều hướng Operator"
      >
        <div className="operator-schedule__brand">
          <BrandLogo placement="header" />
        </div>
        <nav>
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map(([label, icon]) => (
                <button
                  type="button"
                  key={label}
                  aria-current={label === "Chuyến đi" ? "page" : undefined}
                  onClick={() =>
                    label === "Chuyến đi"
                      ? reset()
                      : label === "Đặt chỗ & giao dịch"
                        ? navigate("/operator/bookings")
                        : label === "Tuyến & điểm dừng"
                          ? navigate("/operator/routes")
                          : label === "Xe & sơ đồ ghế"
                            ? navigate("/operator/vehicles")
                            : label === "Hủy vé & hoàn tiền"
                              ? navigate("/operator/refund-requests")
                              : label === "Tài xế"
                                ? navigate("/operator/drivers")
                                : label === "Báo cáo"
                                  ? navigate("/operator/reports")
                                  : unavailable(label ?? "Màn hình")
                  }
                >
                  <img src={icon} width={16} height={16} alt="" />
                  {label}
                </button>
              ))}
            </section>
          ))}
        </nav>
        <div className="operator-schedule__account">
          <span>OP</span>
          <div>
            <strong>Nhân viên</strong>
            <small>BlueLine Co.</small>
          </div>
        </div>
      </aside>
      <main id="operator-schedule-main" className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>Lịch chuyến</h1>
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
              ...CITIES.map((city): [string, string] => [city, city]),
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
              ...CITIES.map((city): [string, string] => [city, city]),
            ]}
          />
          <label className="operator-schedule__query-field">
            <span>Ngày chạy</span>
            <input
              aria-label="Ngày chạy"
              type="date"
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
            {query.isPending ? (
              <p className="operator-schedule__state" role="status">
                Đang tải lịch chuyến…
              </p>
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
                    onOpen={() =>
                      void navigate(
                        `/operator/trips/${encodeURIComponent(trip.id)}`,
                      )
                    }
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
                {Array.from({ length: pages }, (_, index) => index + 1).map(
                  (number) => (
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
      <Dialog.Root
        open={notice !== null}
        onOpenChange={(open) => {
          if (!open) setNotice(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-schedule__overlay" />
          <Dialog.Content
            className="operator-schedule__dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              lastTrigger.current?.focus();
            }}
          >
            <Dialog.Title>Màn hình đang được phát triển</Dialog.Title>
            <Dialog.Description>{notice}</Dialog.Description>
            <Dialog.Close asChild>
              <Button>Đóng</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
