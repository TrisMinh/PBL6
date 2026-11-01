import { BookingTabs } from "./BookingTabs";
import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactElement, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Input } from "@/shared/ui/Input/Input";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import {
  bookingFiltersSchema,
  BOOKING_STATUS,
  PAYMENT_STATUS,
  type BookingFilters,
  type OperatorBooking,
} from "./bookings.schema";
import { getOperatorBookings } from "./bookingsRepository";
import "../schedule/SchedulePage.css";
import "./RecentBookingsPage.css";
const dateLabel = (value: string): string =>
  value.split("-").reverse().join("/");
const number = (value: number): string =>
  new Intl.NumberFormat("vi-VN").format(value);
export function RecentBookingsPage(): ReactElement {
  const [params, setParams] = useSearchParams();
  const parsed = bookingFiltersSchema.safeParse(Object.fromEntries(params));
  const applied = parsed.success ? parsed.data : bookingFiltersSchema.parse({});
  const [filters, setFilters] = useState<BookingFilters>(applied);
  const [dateOpen, setDateOpen] = useState(false),
    [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<OperatorBooking | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["operator", "recent-bookings", applied],
    queryFn: ({ signal }) => getOperatorBookings(applied, signal),
  });
  const data = query.data;
  const apply = (event: FormEvent): void => {
    event.preventDefault();
    if (filters.from > filters.to) {
      setNotice("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
      return;
    }
    setNotice("");
    setSelected([]);
    update({ ...filters, page: 1 });
  };
  const update = (value: BookingFilters): void => {
    setParams(
      new URLSearchParams(
        Object.entries(value).map(([k, v]) => [k, String(v)]),
      ),
    );
  };
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / 9));
  return (
    <div className="operator-schedule operator-bookings">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>Đặt chỗ &amp; giao dịch</h1>
        </header>
        <BookingTabs />
        <form className="operator-bookings__toolbar" onSubmit={apply}>
          <Input
            label="Tìm kiếm"
            placeholder="Tên, SĐT hoặc mã đặt chỗ"
            value={filters.search}
            maxLength={100}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
          <div className="operator-bookings__filter">
            <span>Thời gian</span>
            <button
              type="button"
              onClick={() => setDateOpen(true)}
              aria-label="Thời gian đặt chỗ"
            >
              {dateLabel(filters.from)} – {dateLabel(filters.to)}
            </button>
          </div>
          <label className="operator-bookings__filter">
            <span>Trạng thái</span>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: e.target.value as BookingFilters["status"],
                })
              }
            >
              <option value="all">Tất cả</option>
              {Object.entries(BOOKING_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="operator-bookings__filter">
            <span>Thanh toán</span>
            <select
              value={filters.payment}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  payment: e.target.value as BookingFilters["payment"],
                })
              }
            >
              <option value="all">Tất cả</option>
              {Object.entries(PAYMENT_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">Lọc kết quả</Button>
        </form>
        {notice && (
          <p className="operator-bookings__notice" role="status">
            {notice}
          </p>
        )}
        <section
          className="operator-bookings__panel"
          aria-labelledby="recent-bookings-title"
          aria-busy={query.isFetching}
        >
          <div className="operator-bookings__title">
            <h2 id="recent-bookings-title">Đặt chỗ gần đây</h2>
            {data && <span>{number(data.total)} lượt</span>}
            {selected.length > 0 && (
              <small role="status">Đã chọn {selected.length} đặt chỗ</small>
            )}
          </div>
          {query.isPending ? (
            <p role="status">Đang tải đặt chỗ…</p>
          ) : query.isError ? (
            <PageState
              title="Không tải được đặt chỗ"
              description={query.error.message}
              action={
                <Button onClick={() => void query.refetch()}>Thử lại</Button>
              }
            />
          ) : !data?.items.length ? (
            <PageState
              title="Không tìm thấy đặt chỗ"
              description="Thử đổi từ khóa hoặc bộ lọc."
              action={
                <Button
                  onClick={() => {
                    const defaults = bookingFiltersSchema.parse({});
                    setFilters(defaults);
                    update(defaults);
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
                aria-label="Bảng đặt chỗ, cuộn ngang để xem đủ các cột"
              >
                <table>
                  <colgroup>
                    {[26, 120, 180, 185, 130, 70, 150, 195, 110].map(
                      (width, i) => (
                        <col key={i} style={{ width }} />
                      ),
                    )}
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        "",
                        "MÃ ĐẶT CHỖ",
                        "HÀNH KHÁCH",
                        "CHUYẾN XE",
                        "KHỞI HÀNH",
                        "GHẾ",
                        "THANH TOÁN",
                        "TRẠNG THÁI",
                        "THAO TÁC",
                      ].map((label, i) => (
                        <th key={i} scope="col">
                          {label || (
                            <span className="operator-bookings__sr">
                              Chọn đặt chỗ
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${item.id}`}
                            checked={selected.includes(item.id)}
                            onChange={(e) =>
                              setSelected((old) =>
                                e.target.checked
                                  ? [...old, item.id]
                                  : old.filter((id) => id !== item.id),
                              )
                            }
                          />
                        </td>
                        <td>{item.id}</td>
                        <td>
                          <strong>{item.name}</strong>
                        </td>
                        <td>
                          {item.tripId} · {item.origin} → {item.destination}
                        </td>
                        <td>
                          {dateLabel(item.departureDate).slice(0, 5)} ·{" "}
                          {item.departureTime}
                        </td>
                        <td>
                          <strong>{item.seat}</strong>
                        </td>
                        <td>{number(item.amount)}đ</td>
                        <td>
                          <span
                            className={`operator-bookings__badge operator-bookings__badge--${item.status === "cancelled" ? "cancelled" : item.payment}`}
                          >
                            {item.status === "cancelled"
                              ? BOOKING_STATUS.cancelled
                              : PAYMENT_STATUS[item.payment]}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="operator-bookings__detail"
                            aria-label={`Chi tiết ${item.id}`}
                            onClick={() => setDetail(item)}
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <footer className="operator-bookings__pagination">
                <p>
                  Hiển thị {(data.page - 1) * data.pageSize + 1}–
                  {Math.min(data.page * data.pageSize, data.total)} trong{" "}
                  {number(data.total)} lượt đặt chỗ
                </p>
                <nav aria-label="Phân trang đặt chỗ">
                  {data.page > 1 && (
                    <button
                      type="button"
                      aria-label="Trang trước"
                      onClick={() => {
                        setSelected([]);
                        update({ ...applied, page: data.page - 1 });
                      }}
                    >
                      ‹
                    </button>
                  )}
                  {[
                    data.page,
                    ...(data.page < pages ? [data.page + 1] : []),
                  ].map((page) => (
                    <button
                      key={page}
                      type="button"
                      aria-current={page === data.page ? "page" : undefined}
                      onClick={() => {
                        setSelected([]);
                        update({ ...applied, page });
                      }}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Trang sau"
                    disabled={data.page === pages}
                    onClick={() => {
                      setSelected([]);
                      update({ ...applied, page: data.page + 1 });
                    }}
                  >
                    ›
                  </button>
                </nav>
              </footer>
            </>
          )}
        </section>
        <Dialog.Root open={dateOpen} onOpenChange={setDateOpen}>
          <Dialog.Portal>
            <Dialog.Overlay className="operator-bookings__overlay" />
            <Dialog.Content className="operator-bookings__dialog">
              <Dialog.Title>Thời gian đặt chỗ</Dialog.Title>
              <Dialog.Description>
                Lọc theo ngày tạo đặt chỗ; ngày khởi hành được hiển thị trong
                bảng.
              </Dialog.Description>
              <Input
                label="Từ ngày"
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value })
                }
              />
              <Input
                label="Đến ngày"
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
              {(!filters.from || !filters.to || filters.from > filters.to) && (
                <p role="alert">Chọn khoảng thời gian hợp lệ.</p>
              )}
              <Button
                disabled={
                  !filters.from || !filters.to || filters.from > filters.to
                }
                onClick={() => setDateOpen(false)}
              >
                Chọn khoảng thời gian
              </Button>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <Dialog.Root
          open={!!detail}
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="operator-bookings__overlay" />
            <Dialog.Content className="operator-bookings__dialog">
              <Dialog.Title>Chi tiết {detail?.id}</Dialog.Title>
              <Dialog.Description>
                Thông tin đặt chỗ trong dữ liệu mô phỏng Operator.
              </Dialog.Description>
              {detail && (
                <dl>
                  {Object.entries({
                    "Hành khách": detail.name,
                    "Số điện thoại": detail.phone,
                    "Chuyến xe": `${detail.tripId} · ${detail.origin} → ${detail.destination}`,
                    "Khởi hành": `${dateLabel(detail.departureDate)} · ${detail.departureTime}`,
                    Ghế: detail.seat,
                    "Số tiền": `${number(detail.amount)}đ`,
                    "Trạng thái": BOOKING_STATUS[detail.status],
                    "Thanh toán": PAYMENT_STATUS[detail.payment],
                  }).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
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
