import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactElement, type FormEvent } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Input } from "@/shared/ui/Input/Input";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { getTripPassengers } from "./tripListsRepository";
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
  const data = query.data,
    trip = data?.trip;
  const matches =
    data?.passengers.filter(
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
          <h1>Danh sách hành khách · {tripId}</h1>
        </header>
        {query.isPending ? (
          <p role="status">Đang tải danh sách hành khách…</p>
        ) : query.isError ? (
          <PageState
            title="Không tải được danh sách hành khách"
            description={query.error.message}
            action={
              <>
                <Link to={returnTo}>Danh sách theo chuyến</Link>
                <Button onClick={() => void query.refetch()}>Thử lại</Button>
              </>
            }
          />
        ) : (
          trip &&
          data && (
            <>
              <section
                className="operator-manifest__summary"
                aria-label="Tóm tắt chuyến"
              >
                <div className="operator-manifest__back">
                  <Link to={returnTo}>← Danh sách theo chuyến</Link>
                </div>
                <div className="operator-manifest__route">
                  <h2>{trip.id}</h2>
                  <strong>
                    {trip.origin} → {trip.destination}
                  </strong>
                  <small>{dateLabel(trip.date)}</small>
                </div>
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
                    {trip.booked} / {trip.capacity} ghế
                  </strong>
                  <small>{trip.capacity - trip.booked} ghế còn trống</small>
                </div>
                <div>
                  <span>CHECK-IN</span>
                  <strong className="operator-manifest__count">
                    {trip.checkedIn} / {trip.booked}
                  </strong>
                  <small>
                    {trip.checkedIn
                      ? "Đã có khách check-in"
                      : "Chưa mở check-in"}
                  </small>
                </div>
                <span
                  className={`operator-bookings__badge operator-manifest__status operator-manifest__status--${trip.status}`}
                >
                  {TRIP_LIST_STATUS[trip.status]}
                </span>
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
                    {[
                      ...new Set(
                        data.passengers.map((person) => person.pickup),
                      ),
                    ].map((pickup) => (
                      <option key={pickup}>{pickup}</option>
                    ))}
                  </select>
                </label>
                <label className="operator-bookings__filter">
                  <span>Thanh toán</span>
                  <select
                    value={filters.payment}
                    onChange={(event) =>
                      setFilters({
                        ...filters,
                        payment: event.target
                          .value as PassengerFilters["payment"],
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
                        checkIn: event.target
                          .value as PassengerFilters["checkIn"],
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
                className="operator-bookings__panel"
                aria-labelledby="passenger-manifest-title"
              >
                <div className="operator-bookings__title">
                  <h2 id="passenger-manifest-title">Hành khách trên chuyến</h2>
                  <span>{data.passengers.length} hành khách</span>
                  {selected.length > 0 && (
                    <small role="status">
                      Đã chọn {selected.length} hành khách
                    </small>
                  )}
                </div>
                {!visible.length ? (
                  <PageState
                    title={
                      data.passengers.length
                        ? "Không tìm thấy hành khách"
                        : "Chưa có hành khách"
                    }
                    description={
                      data.passengers.length
                        ? "Thử thay đổi từ khóa hoặc bộ lọc."
                        : "Chuyến này chưa có đặt chỗ."
                    }
                    action={
                      data.passengers.length ? (
                        <Button
                          onClick={() => {
                            const defaults = passengerFiltersSchema.parse({});
                            setFilters(defaults);
                            update(defaults);
                          }}
                        >
                          Đặt lại bộ lọc
                        </Button>
                      ) : undefined
                    }
                  />
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
                                            (code) =>
                                              code !== person.ticketCode,
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
                                <span
                                  className={`operator-bookings__badge operator-bookings__badge--${person.payment}`}
                                >
                                  {person.payment === "paid"
                                    ? "Đã thanh toán"
                                    : "Chờ thanh toán"}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`operator-bookings__badge operator-manifest__boarding--${person.boardingStatus}`}
                                >
                                  {BOARDING_LABEL[person.boardingStatus]}
                                </span>
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
                        {Math.min(page * 9, matches.length)} trong{" "}
                        {matches.length} hành khách
                      </p>
                      <nav aria-label="Phân trang hành khách">
                        {page > 1 && (
                          <button
                            type="button"
                            aria-label="Trang trước"
                            onClick={() =>
                              update({ ...applied, page: page - 1 })
                            }
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
                              onClick={() =>
                                update({ ...applied, page: value })
                              }
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
            </>
          )
        )}
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
