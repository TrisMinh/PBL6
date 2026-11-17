import { OperatorStatusBadge } from "../components/OperatorStatusBadge";
import { ArrowLeft } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { Users } from "@phosphor-icons/react/dist/csr/Users";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { displayCode } from "../components/displayCode";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactElement, type FormEvent } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Input } from "@/shared/ui/Input/Input";
import { Button } from "@/shared/ui/Button/Button";
import { getPassengerTrip, getTripPassengers } from "./tripListsRepository";
import { TRIP_LIST_STATUS, type ManifestPassenger } from "./tripLists.schema";
import {
  passengerFiltersSchema,
  BOARDING_LABEL,
  normalizePassenger,
  type PassengerFilters,
} from "./passengers.schema";
import "../schedule/SchedulePage.css";
import "./RecentBookingsPage.css";
import "./PassengerManifestPage.css";
const dateLabel = (value: string): string =>
  value.split("-").reverse().join("/");
export function PassengerManifestPage(): ReactElement {
  const { tripId = "" } = useParams();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const parsed = passengerFiltersSchema.safeParse(Object.fromEntries(params));
  const applied = parsed.success
    ? parsed.data
    : passengerFiltersSchema.parse({});
  const [filters, setFilters] = useState<PassengerFilters>(applied),
    [selected, setSelected] = useState<string[]>([]),
    [ticket, setTicket] = useState<ManifestPassenger | null>(null);
  const query = useQuery({
    queryKey: ["operator", "passenger-manifest", tripId],
    queryFn: ({ signal }) => getTripPassengers(tripId, signal),
    enabled: !!tripId,
    retry: 1,
  });
  const tripQuery = useQuery({
    queryKey: ["operator", "passenger-trip-summary", tripId],
    queryFn: ({ signal }) => getPassengerTrip(tripId, signal),
    enabled: !!tripId,
    retry: 1,
  });
  const passengers = query.data;
  const trip = tripQuery.data;
  const booked = passengers?.length || trip?.booked || 0;
  const checkedIn = passengers?.filter(
    (person) => person.boardingStatus === "checked-in",
  ).length;
  const matches =
    passengers?.filter(
      (person) =>
        normalizePassenger(
          `${person.name} ${person.phone} ${person.ticketCode}`,
        ).includes(normalizePassenger(applied.search.trim())) &&
        (applied.pickup === "all" || person.pickup === applied.pickup) &&
        (applied.payment === "all" || person.payment === applied.payment) &&
        (applied.checkIn === "all" ||
          person.boardingStatus === applied.checkIn),
    ) ?? [];
  const page = Math.min(
      applied.page,
      Math.max(1, Math.ceil(matches.length / 9)),
    ),
    pages = Math.max(1, Math.ceil(matches.length / 9)),
    visible = matches.slice((page - 1) * 9, page * 9);
  const update = (value: PassengerFilters): void => {
    setSelected([]);
    setParams(
      new URLSearchParams(
        Object.entries(value).map(([key, v]) => [key, String(v)]),
      ),
      { state: location.state },
    );
  };
  const apply = (event: FormEvent): void => {
    event.preventDefault();
    update({ ...filters, page: 1 });
  };
  const returnTo =
    typeof location.state?.returnTo === "string" &&
    location.state.returnTo.startsWith("/operator/bookings/trips?")
      ? location.state.returnTo
      : "/operator/bookings/trips";
  return (
    <div className="operator-schedule operator-bookings operator-manifest">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>Danh sách hành khách · {displayCode(tripId)}</h1>
        </header>
        <section
          className="operator-manifest__summary"
          aria-label="Tóm tắt chuyến"
        >
          <div className="operator-manifest__back">
            <Link to={returnTo}>
              <ArrowLeft size={16} aria-hidden="true" />
              Danh sách theo chuyến
            </Link>
          </div>
          {trip && (
            <div className="operator-manifest__route">
              <strong>
                {trip.origin} → {trip.destination}
              </strong>
              <small>{dateLabel(trip.date)}</small>
            </div>
          )}
          {trip ? (
            <>
              <div>
                <span>KHỞI HÀNH</span>
                <strong className="operator-manifest__time">
                  {trip.departure}
                </strong>
                <small>
                  Đến {trip.arrival}
                  {trip.arrival <= trip.departure ? " (+1 ngày)" : ""}
                </small>
              </div>
              <div>
                <span>PHƯƠNG TIỆN</span>
                <strong>{trip.vehicle}</strong>
                <small>{trip.driver}</small>
              </div>
              <div>
                <span>ĐÃ ĐẶT</span>
                <strong className="operator-manifest__count">
                  {booked} / {trip.capacity} ghế
                </strong>
                <small>{trip.capacity - booked} ghế còn trống</small>
              </div>
              <div>
                <span>CHECK-IN</span>
                <strong className="operator-manifest__count">
                  {checkedIn === undefined ? "—" : `${checkedIn} / ${booked}`}
                </strong>
                {checkedIn !== undefined && (
                  <small>
                    {checkedIn ? "Đã có khách check-in" : "Chưa mở check-in"}
                  </small>
                )}
              </div>
              <OperatorStatusBadge state={trip.status}>
                {TRIP_LIST_STATUS[trip.status]}
              </OperatorStatusBadge>
            </>
          ) : tripQuery.isError ? (
            <div className="operator-manifest__summary-error">
              <small>Không tải được thông tin chuyến.</small>
              <Button
                variant="secondary"
                onClick={() => void tripQuery.refetch()}
              >
                Thử lại
              </Button>
            </div>
          ) : null}
        </section>
        <form className="operator-bookings__toolbar" onSubmit={apply}>
          <Input
            label="Tìm kiếm"
            placeholder="Tên, SĐT hoặc mã vé"
            value={filters.search}
            maxLength={100}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
          />
          <label className="operator-bookings__filter">
            <span>Điểm đón</span>
            <select
              value={filters.pickup}
              onChange={(event) =>
                setFilters({ ...filters, pickup: event.target.value })
              }
            >
              <option value="all">Tất cả</option>
              {[...new Set(passengers?.map((person) => person.pickup))].map(
                (pickup) => (
                  <option key={pickup}>{pickup}</option>
                ),
              )}
            </select>
          </label>
          <label className="operator-bookings__filter">
            <span>Thanh toán</span>
            <select
              value={filters.payment}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  payment: event.target.value as PassengerFilters["payment"],
                })
              }
            >
              <option value="all">Tất cả</option>
              <option value="paid">Đã thanh toán</option>
              <option value="unpaid">Chờ thanh toán</option>
            </select>
          </label>
          <label className="operator-bookings__filter">
            <span>Check-in</span>
            <select
              value={filters.checkIn}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  checkIn: event.target.value as PassengerFilters["checkIn"],
                })
              }
            >
              <option value="all">Tất cả</option>
              {Object.entries(BOARDING_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Lọc danh sách</Button>
        </form>
        <section
          className={
            visible.length
              ? "operator-bookings__panel"
              : "operator-bookings__panel operator-manifest__panel--empty"
          }
          aria-labelledby="passenger-manifest-title"
        >
          <div className="operator-bookings__title">
            <h2 id="passenger-manifest-title">Hành khách trên chuyến</h2>
            {!!passengers?.length && (
              <span>{passengers.length} hành khách</span>
            )}
            {selected.length > 0 && (
              <small role="status">Đã chọn {selected.length} hành khách</small>
            )}
          </div>
          {query.isPending ? (
            <div className="operator-manifest__empty" role="status">
              <span
                className="operator-manifest__empty-icon"
                aria-hidden="true"
              >
                <span className="operator-manifest__spinner" />
              </span>
              <h3>Đang tải danh sách hành khách…</h3>
            </div>
          ) : query.isError ? (
            <div className="operator-manifest__empty">
              <h3>Không tải được danh sách hành khách</h3>
              <p>{query.error.message}</p>
              <Button variant="secondary" onClick={() => void query.refetch()}>
                Thử lại
              </Button>
            </div>
          ) : !visible.length ? (
            <div className="operator-manifest__empty">
              <span
                className="operator-manifest__empty-icon"
                aria-hidden="true"
              >
                {passengers?.length ? (
                  <MagnifyingGlass size={25} />
                ) : (
                  <Users size={25} />
                )}
              </span>
              <h3>
                {passengers?.length
                  ? "Không tìm thấy hành khách"
                  : "Chưa có hành khách"}
              </h3>
              <p>
                {passengers?.length
                  ? "Thử thay đổi từ khóa hoặc bộ lọc."
                  : "Chuyến này chưa có đặt chỗ."}
              </p>
              {!!passengers?.length && (
                <Button
                  onClick={() => {
                    const defaults = passengerFiltersSchema.parse({});
                    setFilters(defaults);
                    update(defaults);
                  }}
                  variant="secondary"
                >
                  Đặt lại bộ lọc
                </Button>
              )}
            </div>
          ) : (
            <>
              <div
                className="operator-bookings__scroll"
                tabIndex={0}
                role="region"
                aria-label="Bảng hành khách, cuộn ngang để xem đủ các cột"
              >
                <table>
                  <colgroup>
                    {[26, 95, 155, 120, 65, 240, 125, 215, 125].map(
                      (width, i) => (
                        <col key={i} style={{ width }} />
                      ),
                    )}
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        "",
                        "MÃ VÉ",
                        "HÀNH KHÁCH",
                        "ĐIỆN THOẠI",
                        "GHẾ",
                        "ĐIỂM ĐÓN",
                        "THANH TOÁN",
                        "CHECK-IN",
                        "THAO TÁC",
                      ].map((label, i) => (
                        <th key={i} scope="col">
                          {label || (
                            <span className="operator-bookings__sr">
                              Chọn hành khách
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((person) => (
                      <tr key={person.ticketCode}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${person.ticketCode}`}
                            checked={selected.includes(person.ticketCode)}
                            onChange={(event) =>
                              setSelected((old) =>
                                event.target.checked
                                  ? [...old, person.ticketCode]
                                  : old.filter(
                                      (code) => code !== person.ticketCode,
                                    ),
                              )
                            }
                          />
                        </td>
                        <td>{person.ticketCode}</td>
                        <td>
                          <strong>{person.name}</strong>
                        </td>
                        <td>{person.phone}</td>
                        <td>
                          <strong>{person.seat}</strong>
                        </td>
                        <td>{person.pickup}</td>
                        <td>
                          <OperatorStatusBadge state={person.payment}>
                            {person.payment === "paid"
                              ? "Đã thanh toán"
                              : "Chờ thanh toán"}
                          </OperatorStatusBadge>
                        </td>
                        <td>
                          <OperatorStatusBadge state={person.boardingStatus}>
                            {BOARDING_LABEL[person.boardingStatus]}
                          </OperatorStatusBadge>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="operator-bookings__detail"
                            aria-label={`Xem vé ${person.ticketCode}`}
                            onClick={() => setTicket(person)}
                          >
                            Xem vé
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="operator-bookings__pagination">
                <p>
                  Hiển thị {(page - 1) * 9 + 1}–
                  {Math.min(page * 9, matches.length)} trong {matches.length}{" "}
                  hành khách
                </p>
                <nav aria-label="Phân trang hành khách">
                  {page > 1 && (
                    <button
                      type="button"
                      aria-label="Trang trước"
                      onClick={() => update({ ...applied, page: page - 1 })}
                    >
                      ‹
                    </button>
                  )}
                  {Array.from({ length: pages }, (_, i) => i + 1).map(
                    (value) => (
                      <button
                        type="button"
                        key={value}
                        aria-current={page === value ? "page" : undefined}
                        onClick={() => update({ ...applied, page: value })}
                      >
                        {value}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={page === pages}
                    onClick={() => update({ ...applied, page: page + 1 })}
                  >
                    ›
                  </button>
                </nav>
              </footer>
            </>
          )}
        </section>
        <Dialog.Root
          open={!!ticket}
          onOpenChange={(open) => {
            if (!open) setTicket(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="operator-bookings__overlay" />
            <Dialog.Content className="operator-bookings__dialog">
              <Dialog.Title>Vé {ticket?.ticketCode}</Dialog.Title>
              <Dialog.Description>
                Thông tin vé mô phỏng của chuyến {tripId}.
              </Dialog.Description>
              {ticket && (
                <dl>
                  {Object.entries({
                    "Hành khách": ticket.name,
                    "Điện thoại": ticket.phone,
                    Ghế: ticket.seat,
                    "Điểm đón": ticket.pickup,
                    "Khởi hành": trip
                      ? `${dateLabel(trip.date)} · ${trip.departure}`
                      : "",
                    "Thanh toán":
                      ticket.payment === "paid"
                        ? "Đã thanh toán"
                        : "Chờ thanh toán",
                    "Check-in": BOARDING_LABEL[ticket.boardingStatus],
                  }).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Dialog.Close asChild>
                <Button>Đóng</Button>
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </main>
    </div>
  );
}
