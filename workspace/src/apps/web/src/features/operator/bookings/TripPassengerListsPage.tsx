import { useState, type ReactElement, type FormEvent } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Input } from "@/shared/ui/Input/Input";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { BookingTabs } from "./BookingTabs";
import { getPassengerTrips } from "./tripListsRepository";
import {
  tripListFiltersSchema,
  TRIP_LIST_STATUS,
  type TripListFilters,
} from "./tripLists.schema";
import "../schedule/SchedulePage.css";
import "./RecentBookingsPage.css";
import "./TripPassengerListsPage.css";
const dateLabel = (date: string): string => date.split("-").reverse().join("/");
export function TripPassengerListsPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const parsed = tripListFiltersSchema.safeParse(Object.fromEntries(params));
  const applied = parsed.success
    ? parsed.data
    : tripListFiltersSchema.parse({});
  const [filters, setFilters] = useState<TripListFilters>(applied),
    [dateText, setDateText] = useState(dateLabel(applied.date));
  const [notice, setNotice] = useState(""),
    [selected, setSelected] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["operator", "passenger-trips", applied],
    queryFn: ({ signal }) => getPassengerTrips(applied, signal),
  });
  const apply = (event: FormEvent): void => {
    event.preventDefault();
    const result = tripListFiltersSchema.safeParse({
      ...filters,
      date: dateText.split("/").reverse().join("-"),
    });
    if (!result.success) {
      setNotice("Nhập ngày hợp lệ theo định dạng DD/MM/YYYY.");
      return;
    }
    setNotice("");
    setSelected([]);
    setParams(new URLSearchParams(result.data));
  };
  return (
    <div className="operator-schedule operator-bookings operator-trip-lists">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>Đặt chỗ &amp; giao dịch</h1>
        </header>
        <BookingTabs />
        <form className="operator-bookings__toolbar" onSubmit={apply}>
          <Input
            label="Tìm chuyến"
            placeholder="Mã chuyến hoặc tuyến đường"
            value={filters.search}
            maxLength={100}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
          />
          <Input
            label="Ngày chạy"
            title="Hiển thị các chuyến từ ngày này trở đi"
            placeholder="DD/MM/YYYY"
            value={dateText}
            inputMode="numeric"
            required
            onChange={(event) => setDateText(event.target.value)}
          />
          <label className="operator-bookings__filter">
            <span>Tuyến</span>
            <select
              value={filters.route}
              onChange={(event) =>
                setFilters({ ...filters, route: event.target.value })
              }
            >
              <option value="all">Tất cả tuyến</option>
              {query.data?.routes.map((route) => (
                <option key={route}>{route}</option>
              ))}
            </select>
          </label>
          <label className="operator-bookings__filter">
            <span>Trạng thái</span>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: event.target.value as TripListFilters["status"],
                })
              }
            >
              <option value="all">Tất cả</option>
              {Object.entries(TRIP_LIST_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Tìm chuyến</Button>
        </form>
        {notice && (
          <p role="alert" className="operator-bookings__notice">
            {notice}
          </p>
        )}
        <section
          className="operator-bookings__panel"
          aria-labelledby="passenger-trip-title"
          aria-busy={query.isFetching}
        >
          <div className="operator-bookings__title">
            <h2 id="passenger-trip-title">Danh sách theo chuyến</h2>
            {selected.length > 0 && (
              <small role="status">Đã chọn {selected.length} chuyến</small>
            )}
          </div>
          {query.isPending ? (
            <p role="status">Đang tải chuyến…</p>
          ) : query.isError ? (
            <PageState
              title="Không tải được chuyến"
              description={query.error.message}
              action={
                <Button onClick={() => void query.refetch()}>Thử lại</Button>
              }
            />
          ) : query.data.items.length === 0 ? (
            <PageState
              title="Không tìm thấy chuyến"
              description="Thử thay đổi từ khóa, ngày chạy hoặc bộ lọc."
              action={
                <Button
                  onClick={() => {
                    const defaults = tripListFiltersSchema.parse({});
                    setFilters(defaults);
                    setDateText(dateLabel(defaults.date));
                    setParams(new URLSearchParams(defaults));
                  }}
                >
                  Đặt lại bộ lọc
                </Button>
              }
            />
          ) : (
            <>
              <div
                className="operator-bookings__scroll"
                tabIndex={0}
                role="region"
                aria-label="Bảng chuyến xe, cuộn ngang để xem đầy đủ"
              >
                <table>
                  <colgroup>
                    {[26, 110, 190, 130, 120, 155, 80, 90, 145, 120].map(
                      (width, i) => (
                        <col key={i} style={{ width }} />
                      ),
                    )}
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        "",
                        "MÃ CHUYẾN",
                        "TUYẾN",
                        "KHỞI HÀNH",
                        "ĐẾN",
                        "PHƯƠNG TIỆN",
                        "ĐÃ ĐẶT",
                        "CHECK-IN",
                        "TRẠNG THÁI",
                        "THAO TÁC",
                      ].map((label, i) => (
                        <th scope="col" key={i}>
                          {label || (
                            <span className="operator-bookings__sr">
                              Chọn chuyến
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${item.id}`}
                            checked={selected.includes(item.id)}
                            onChange={(event) =>
                              setSelected((old) =>
                                event.target.checked
                                  ? [...old, item.id]
                                  : old.filter((id) => id !== item.id),
                              )
                            }
                          />
                        </td>
                        <td>
                          <strong>{item.id}</strong>
                        </td>
                        <td>
                          {item.origin} → {item.destination}
                        </td>
                        <td>
                          {dateLabel(item.date).slice(0, 5)} · {item.departure}
                        </td>
                        <td>
                          <span
                            title={
                              item.arrival <= item.departure
                                ? "Đến vào ngày hôm sau"
                                : undefined
                            }
                          >
                            {item.arrival}
                          </span>
                        </td>
                        <td
                          className={
                            item.vehicle === "Chưa phân công"
                              ? "operator-trip-lists__unassigned"
                              : undefined
                          }
                        >
                          {item.vehicle}
                        </td>
                        <td>
                          <strong>
                            {item.booked}/{item.capacity}
                          </strong>
                        </td>
                        <td>
                          {item.checkedIn}/{item.booked}
                        </td>
                        <td>
                          <strong
                            className={
                              item.status === "conflict"
                                ? "operator-trip-lists__conflict"
                                : undefined
                            }
                          >
                            {TRIP_LIST_STATUS[item.status]}
                          </strong>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="operator-bookings__detail"
                            aria-label={`Xem danh sách ${item.id}`}
                            onClick={() =>
                              void navigate(
                                `/operator/bookings/trips/${item.id}/passengers`,
                                {
                                  state: {
                                    returnTo:
                                      location.pathname + location.search,
                                  },
                                },
                              )
                            }
                          >
                            Xem danh sách
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="operator-bookings__pagination">
                <p>
                  Hiển thị 1–{query.data.items.length} trong{" "}
                  {query.data.items.length} chuyến
                </p>
              </footer>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
