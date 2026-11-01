import { useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ScheduleCard } from "./schedule/SchedulePage";
import type { ScheduleTrip } from "./schedule/schedule.schema";
import { getLiveRows, liveQueryKey } from "@/shared/api/liveRequest";
import {
  normalizeSearch,
  shortId,
  stateLabel,
} from "@/shared/api/livePresentation";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";
import type { ApiRow } from "@/shared/api/fields";
import { LiveDriverAssignments } from "./LiveDriverAssignments";
import { LiveOrganizationProfile } from "./LiveOrganizationProfile";
import "./LiveOperatorSchedule.css";

function localParts(value: unknown): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(String(value)))
      .map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
export function LiveOperatorSchedule(): ReactElement {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [requestedPage, setPage] = useState(0);
  const query = useQuery({
    queryKey: liveQueryKey("operator-schedule"),
    queryFn: ({ signal }) => getLiveRows("/api/v1/operator/trips", signal),
    retry: false,
  });
  const buses = useQuery({
    queryKey: liveQueryKey("operator-buses"),
    queryFn: ({ signal }) => getLiveRows("/api/v1/operator/buses", signal),
    retry: false,
  });
  const bookings = useQuery({
    queryKey: liveQueryKey("operator-bookings-summary"),
    queryFn: ({ signal }) => getLiveRows("/api/v1/operator/bookings", signal),
    retry: false,
  });
  if (params.get("view") === "organization")
    return (
      <>
        <header className="live-schedule__heading">
          <div>
            <p>QUẢN TRỊ</p>
            <h1>Hồ sơ nhà xe</h1>
            <span>Thông tin liên hệ và chính sách thanh toán.</span>
          </div>
          <Button variant="secondary" onClick={() => setParams({})}>
            Lịch chuyến
          </Button>
        </header>
        <LiveOrganizationProfile />
        <LiveDriverAssignments />
      </>
    );
  const rows = query.data ?? [];
  const statuses = [...new Set(rows.map((row) => String(row.status)))];
  const origins = [...new Set(rows.map((row) => String(row.origin)))].sort(
    (a, b) => a.localeCompare(b, "vi"),
  );
  const destinations = [
    ...new Set(
      rows
        .filter((row) => !origin || row.origin === origin)
        .map((row) => String(row.destination)),
    ),
  ].sort((a, b) => a.localeCompare(b, "vi"));
  const filtered = rows.filter(
    (row) =>
      (!origin || row.origin === origin) &&
      (!destination || row.destination === destination) &&
      (!date || localParts(row.departureAt).date === date) &&
      (!status || row.status === status) &&
      (!search ||
        normalizeSearch(JSON.stringify(row)).includes(normalizeSearch(search))),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 5));
  const page = Math.min(requestedPage, pages - 1);
  const reset = (): void => {
    setSearch("");
    setDate("");
    setStatus("");
    setOrigin("");
    setDestination("");
    setPage(0);
  };
  const card = (row: ApiRow): ScheduleTrip => {
    const bus = buses.data?.find((bus) => bus.id === row.busId);
    const count =
      bookings.data
        ?.filter(
          (booking) =>
            booking.tripId === row.id &&
            ["PAID", "CONFIRMED", "PENDING_PAYMENT", "COMPLETED"].includes(
              String(booking.status),
            ),
        )
        .reduce(
          (total, booking) =>
            total + (Array.isArray(booking.items) ? booking.items.length : 0),
          0,
        ) ?? 0;
    return {
      id: String(row.id),
      origin: String(row.origin),
      destination: String(row.destination),
      date: localParts(row.departureAt).date,
      departure: localParts(row.departureAt).time,
      arrival: localParts(row.arrivalAt).time,
      vehicleLabel: bus
        ? `${bus.plateNumber} · ${stateLabel(String(bus.type))}`
        : stateLabel(String(row.busType)),
      crew: row.driverId ? "Đã phân công tài xế" : "Xem phân công tài xế",
      passengers: count,
      capacity:
        bus && Array.isArray(bus.seats)
          ? bus.seats.length
          : Math.max(count, Number(row.availableSeatCount) || 1),
      status:
        row.status === "DRAFT"
          ? "draft"
          : row.status === "BOARDING"
            ? "boarding"
            : "scheduled",
      assignment: row.driverId && row.busId ? "complete" : "missing",
    };
  };
  return (
    <section className="operator-schedule operator-schedule--embedded live-schedule">
      <header className="live-schedule__heading">
        <div>
          <p>VẬN HÀNH NHÀ XE</p>
          <h1>Lịch chuyến</h1>
          <span>
            Theo dõi lịch chạy, phân công và hành khách trên từng chuyến.
          </span>
        </div>
        <Link className="button button--primary" to="/operator/trips/new">
          ＋ Tạo chuyến mới
        </Link>
      </header>
      <div className="live-schedule__stats">
        <div>
          <span>Tổng chuyến</span>
          <strong>{rows.length}</strong>
        </div>
        <div>
          <span>Đã lên lịch</span>
          <strong>
            {rows.filter((row) => row.status === "SCHEDULED").length}
          </strong>
        </div>
        <div>
          <span>Đang đón khách</span>
          <strong>
            {rows.filter((row) => row.status === "BOARDING").length}
          </strong>
        </div>
        <div>
          <span>Bản nháp</span>
          <strong>{rows.filter((row) => row.status === "DRAFT").length}</strong>
        </div>
      </div>
      <form
        className="live-schedule__query"
        onSubmit={(e) => e.preventDefault()}
      >
        <label>
          Điểm đi
          <select
            value={origin}
            onChange={(e) => {
              setOrigin(e.target.value);
              setDestination("");
              setPage(0);
            }}
          >
            <option value="">Tất cả điểm đi</option>
            {origins.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Điểm đến
          <select
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value);
              setPage(0);
            }}
          >
            <option value="">Tất cả điểm đến</option>
            {destinations.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Ngày chạy
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Tìm chuyến
          <input
            type="search"
            placeholder="Nhập mã hoặc hành trình…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <Button
          variant="secondary"
          onClick={() => void query.refetch()}
          isLoading={query.isFetching}
        >
          Làm mới
        </Button>
      </form>
      <div className="live-schedule__body">
        <aside className="live-schedule__filters">
          <div>
            <h2>Bộ lọc</h2>
            <button type="button" onClick={reset}>
              Đặt lại
            </button>
          </div>
          <fieldset>
            <legend>Trạng thái chuyến</legend>
            <label>
              <input
                type="radio"
                name="trip-status"
                checked={!status}
                onChange={() => {
                  setStatus("");
                  setPage(0);
                }}
              />
              Tất cả trạng thái
            </label>
            {statuses.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name="trip-status"
                  checked={status === value}
                  onChange={() => {
                    setStatus(value);
                    setPage(0);
                  }}
                />
                {stateLabel(value)}
              </label>
            ))}
          </fieldset>
          <Link to="/operator/bookings/trips">Xem danh sách hành khách →</Link>
        </aside>
        <div className="live-schedule__results">
          <div className="live-schedule__result-heading">
            <strong>{filtered.length} chuyến phù hợp</strong>
            <span>Dữ liệu lịch chạy thực tế</span>
          </div>
          {query.isPending ? (
            <p role="status">Đang tải lịch chuyến…</p>
          ) : query.isError ? (
            <ApiFailure
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : filtered.length ? (
            filtered.slice(page * 5, (page + 1) * 5).map((row) => (
              <div className="live-schedule__card" key={String(row.id)}>
                <div className="live-schedule__card-date">
                  {new Date(String(row.departureAt)).toLocaleDateString(
                    "vi-VN",
                    {
                      timeZone: "Asia/Ho_Chi_Minh",
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    },
                  )}
                </div>
                <ScheduleCard
                  trip={card(row)}
                  displayCode={shortId(String(row.id))}
                  statusLabel={stateLabel(String(row.status))}
                  showPassengerCount={Boolean(bookings.data)}
                  onOpen={() =>
                    void navigate(
                      `/operator/trips/${encodeURIComponent(String(row.id))}`,
                    )
                  }
                />
                <Link
                  className="live-schedule__manifest"
                  to={`/operator/bookings/trips/${encodeURIComponent(String(row.id))}/passengers`}
                >
                  Danh sách hành khách →
                </Link>
              </div>
            ))
          ) : (
            <div className="live-api__empty">
              <h3>Không có chuyến phù hợp</h3>
              <p>Thay đổi ngày hoặc đặt lại bộ lọc để tìm chuyến khác.</p>
              <Button variant="secondary" onClick={reset}>
                Đặt lại bộ lọc
              </Button>
            </div>
          )}
          <nav
            className="live-api__pagination"
            aria-label="Phân trang lịch chuyến"
          >
            <span>
              Trang {page + 1} / {pages}
            </span>
            <div>
              <Button
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Trước
              </Button>
              <Button
                variant="secondary"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </Button>
            </div>
          </nav>
        </div>
      </div>
      <LiveDriverAssignments />
    </section>
  );
}
