import * as Dialog from "@radix-ui/react-dialog";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { Button } from "@/shared/ui/Button/Button";
import type { RevenueRange } from "./revenueReport";
import "./BookingReportOrders.css";

const schema = z.object({
  total: z.int().nonnegative(),
  items: z.array(
    z.object({
      code: z.string(),
      date: z.iso.date(),
      route: z.string(),
      status: z.string(),
      channel: z.string(),
      tickets: z.int().nonnegative(),
      checkedIn: z.int().nonnegative(),
    }),
  ),
});

const pageSize = 15;
const number = new Intl.NumberFormat("vi-VN");

export interface BookingOrderFilters {
  status?: string;
  routeId?: string;
  channel?: string;
  tickets?: "valid" | "checked-in";
}

export function BookingReportOrders({
  initial,
  range,
  allTime,
  routes,
  statuses,
  channels,
  close,
}: {
  initial: BookingOrderFilters;
  range: RevenueRange;
  allTime: boolean;
  routes: { id: string; name: string }[];
  statuses: Readonly<Record<string, string>>;
  channels: Readonly<Record<string, string>>;
  close: () => void;
}): ReactElement {
  const [open, setOpen] = useState(true);
  const [opener] = useState(() => document.activeElement);
  const [route, setRoute] = useState(initial.routeId ?? "");
  const [channel, setChannel] = useState(initial.channel ?? "");
  const [status, setStatus] = useState(initial.status ?? "");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ ...range, page: String(page) });
  if (allTime) params.set("allTime", "true");
  if (route) params.set("routeId", route);
  if (channel) params.set("channel", channel);
  if (status) params.set("status", status);
  if (term) params.set("q", term);
  if (initial.tickets) params.set("tickets", initial.tickets);
  const queryString = params.toString();
  const query = useQuery({
    queryKey: liveQueryKey("operator-booking-report-orders", queryString),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/operator/bookings/analytics/orders?${queryString}`,
        schema,
        { signal },
      ),
    retry: false,
  });
  const total = query.data?.total;
  const pages = Math.ceil((total ?? 0) / pageSize);
  const title =
    initial.tickets === "valid"
      ? "Đơn có vé hợp lệ"
      : initial.tickets === "checked-in"
        ? "Đơn có vé đã check-in"
        : "Danh sách đơn đặt vé";
  const date = (value: string) => value.split("-").reverse().join("/");

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="booking-report-orders__overlay" />
        <Dialog.Content
          className="booking-report-orders"
          onCloseAutoFocus={(event) => {
            if (opener instanceof HTMLElement && opener.isConnected) {
              event.preventDefault();
              opener.focus();
            }
            close();
          }}
        >
          <header className="booking-report-orders__heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {allTime
                  ? `Toàn bộ đến ${date(range.to)}`
                  : `${date(range.from)} – ${date(range.to)}`}{" "}
                · Theo ngày đặt
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="secondary">Đóng</Button>
            </Dialog.Close>
          </header>
          <form
            className="booking-report-orders__filters"
            onSubmit={(event) => {
              event.preventDefault();
              setTerm(search.trim());
              setPage(1);
            }}
          >
            <label className="booking-report-orders__search">
              Mã đơn
              <input
                type="search"
                maxLength={64}
                value={search}
                placeholder="Nhập mã đơn"
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (!event.target.value) {
                    setTerm("");
                    setPage(1);
                  }
                }}
              />
            </label>
            <Button type="submit">Tìm</Button>
            <label>
              Trạng thái
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                {Object.entries(statuses).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tuyến
              <select
                value={route}
                onChange={(event) => {
                  setRoute(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả tuyến</option>
                {route && !routes.some(({ id }) => id === route) && (
                  <option value={route}>Tuyến đang lọc</option>
                )}
                {routes.map(({ id, name }) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cách thanh toán
              <select
                value={channel}
                onChange={(event) => {
                  setChannel(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Tất cả cách thanh toán</option>
                {Object.entries(channels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </form>
          <div
            className="booking-report-orders__results"
            aria-busy={query.isPending}
          >
            {query.isPending && <p role="status">Đang tải đơn đặt vé…</p>}
            {query.isError && (
              <div role="alert">
                <p>Chưa tải được danh sách đơn.</p>
                <Button
                  variant="secondary"
                  onClick={() => void query.refetch()}
                >
                  Thử lại
                </Button>
              </div>
            )}
            {query.data &&
              (query.data.items.length ? (
                <div
                  className="booking-report-orders__table"
                  role="region"
                  aria-label="Bảng đơn đặt vé"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Mã đơn</th>
                        <th scope="col">Ngày đặt</th>
                        <th scope="col">Tuyến</th>
                        <th scope="col">Trạng thái</th>
                        <th scope="col">Thanh toán</th>
                        <th scope="col">Vé hợp lệ</th>
                        <th scope="col">Check-in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {query.data.items.map((item) => (
                        <tr key={item.code}>
                          <th scope="row">{item.code}</th>
                          <td>{date(item.date)}</td>
                          <td>{item.route}</td>
                          <td>{statuses[item.status] ?? item.status}</td>
                          <td>{channels[item.channel] ?? item.channel}</td>
                          <td>{number.format(item.tickets)}</td>
                          <td>{number.format(item.checkedIn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p role="status">
                  {total
                    ? "Trang này không còn đơn. Hãy quay về trang trước."
                    : "Không tìm thấy đơn. Thử đổi mã đơn hoặc bộ lọc."}
                </p>
              ))}
          </div>
          <footer className="booking-report-orders__footer">
            <span role="status">
              {total != null && `${number.format(total)} đơn`}
            </span>
            {(page > 1 || pages > 1) && (
              <div className="booking-report-orders__paging">
                <Button
                  variant="secondary"
                  disabled={page === 1 || query.isPending}
                  onClick={() => setPage(page - 1)}
                >
                  Trước
                </Button>
                <span>
                  Trang {page}
                  {pages >= page ? ` / ${pages}` : ""}
                </span>
                <Button
                  variant="secondary"
                  disabled={page >= pages || query.isPending}
                  onClick={() => setPage(page + 1)}
                >
                  Sau
                </Button>
              </div>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
