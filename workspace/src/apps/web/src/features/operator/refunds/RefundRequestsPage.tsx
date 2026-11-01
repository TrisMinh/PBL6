import * as Dialog from "@radix-ui/react-dialog";
import { useRef, useState, type FormEvent, type ReactElement } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { PageState } from "@/shared/ui/PageState/PageState";
import {
  REFUND_LEVELS,
  REFUND_STATUSES,
  cancellationMinutes,
  refundLeadLabel,
  refundLevel,
  refundFiltersSchema,
  type RefundFilters,
  type RefundRequest,
} from "./refunds.schema";
import { getRefundRequests } from "./refundsRepository";
import navTrips from "@/assets/operator/refunds/imgFrame.svg";
import navBookings from "@/assets/operator/refunds/imgFrame1.svg";
import navRoutes from "@/assets/operator/refunds/imgFrame2.svg";
import navVehicles from "@/assets/operator/refunds/imgFrame3.svg";
import navDrivers from "@/assets/operator/refunds/imgFrame4.svg";
import navReports from "@/assets/operator/refunds/imgFrame5.svg";
import navMembers from "@/assets/operator/refunds/imgFrame6.svg";
import navCancel from "@/assets/operator/refunds/imgFrame7.svg";
import "../schedule/SchedulePage.css";
import "./RefundRequestsPage.css";
const NAV_ICONS = {
  "Chuyến đi": navTrips,
  "Đặt chỗ & giao dịch": navBookings,
  "Tuyến & điểm dừng": navRoutes,
  "Xe & sơ đồ ghế": navVehicles,
  "Tài xế": navDrivers,
  "Báo cáo": navReports,
  "Tổ chức & thành viên": navMembers,
  "Hủy vé & hoàn tiền": navCancel,
};
const dateLabel = (date: string): string => date.split("-").reverse().join("/");
const requestTime = (date: string): string =>
  `${date.slice(8, 10)}/${date.slice(5, 7)} lúc ${date.slice(11, 16)}`;
function dateInput(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value.trim();
}
function leadDetail(item: RefundRequest, minutes: number): string {
  if (minutes >= 1440) return `${Math.floor(minutes / 60)} giờ`;
  return item.requestedAt.slice(0, 10) === item.departureAt.slice(0, 10)
    ? "Cùng ngày"
    : "Qua ngày hôm sau";
}
type Detail = { kind: "policy" } | { kind: "request"; item: RefundRequest };
function RequestDetails({ item }: { item: RefundRequest }): ReactElement {
  const minutes = cancellationMinutes(item.requestedAt, item.departureAt),
    level = REFUND_LEVELS[refundLevel(minutes)];
  return (
    <>
      <dl className="operator-refunds__facts">
        <div>
          <dt>Khách hàng</dt>
          <dd>
            {item.customer} · {item.phone}
          </dd>
        </div>
        <div>
          <dt>Vé đặt / hủy</dt>
          <dd>
            {item.bookedTickets} vé / {item.seats.length} vé ·{" "}
            {item.seats.join(", ")}
          </dd>
        </div>
        <div>
          <dt>Chuyến</dt>
          <dd>
            {item.tripCode} · {item.route}
          </dd>
        </div>
        <div>
          <dt>Xe</dt>
          <dd>
            {item.plate} · {item.vehicleType}
          </dd>
        </div>
        <div>
          <dt>Yêu cầu hủy lúc</dt>
          <dd>
            {requestTime(item.requestedAt)} / {item.requestedAt.slice(0, 4)}
          </dd>
        </div>
        <div>
          <dt>Xe khởi hành</dt>
          <dd>
            {requestTime(item.departureAt)} / {item.departureAt.slice(0, 4)}
          </dd>
        </div>
        <div>
          <dt>Hủy trước</dt>
          <dd>{refundLeadLabel(minutes)}</dd>
        </div>
        <div>
          <dt>Mức chính sách</dt>
          <dd>
            {level.label} · {level.description}
          </dd>
        </div>
        <div>
          <dt>Tiến độ hoàn tiền</dt>
          <dd>{REFUND_STATUSES[item.status]}</dd>
        </div>
      </dl>
      {refundLevel(minutes) === "exception" && (
        <p>Yêu cầu dưới 2 giờ được chuyển sang ngoại lệ để xem xét riêng.</p>
      )}
      <p className="operator-refunds__demo">
        Tiến độ minh họa trong dữ liệu mock. Chưa kết nối giao dịch hoàn tiền
        thực tế.
      </p>
    </>
  );
}
export function RefundRequestsPage(): ReactElement {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const appliedResult = refundFiltersSchema.safeParse(
      Object.fromEntries(params),
    ),
    applied = appliedResult.success
      ? appliedResult.data
      : refundFiltersSchema.parse({});
  const [draft, setDraft] = useState<RefundFilters>(applied),
    [date, setDate] = useState(dateLabel(applied.date)),
    [error, setError] = useState("");
  const [detail, setDetail] = useState<Detail | null>(null),
    [selected, setSelected] = useState("BK-0905-018");
  const focusReturn = useRef<HTMLElement | null>(null);
  const query = useQuery({
    queryKey: ["operator-refund-requests", applied],
    queryFn: ({ signal }) => getRefundRequests(applied, signal),
    enabled: appliedResult.success,
  });
  function apply(event: FormEvent): void {
    event.preventDefault();
    const next = refundFiltersSchema.safeParse({
      ...draft,
      date: dateInput(date),
    });
    if (!next.success) {
      setError("Kiểm tra bộ lọc. Ngày yêu cầu dùng định dạng DD/MM/YYYY.");
      return;
    }
    setError("");
    setParams(new URLSearchParams(next.data));
  }
  function reset(): void {
    const next = refundFiltersSchema.parse({ date: "" });
    setDraft(next);
    setDate("");
    setError("");
    setParams(new URLSearchParams(next));
  }
  const items = query.data?.items ?? [];
  return (
    <div className="operator-schedule operator-refunds">
      <a className="operator-schedule__skip" href="#refunds-main">
        Đến nội dung chính
      </a>
      <OperatorSidebar iconsOverride={NAV_ICONS} />
      <main className="operator-schedule__main" id="refunds-main">
        <header className="operator-schedule__header">
          <h1>Hủy vé và hoàn tiền</h1>
        </header>
        <form className="operator-refunds__filters" onSubmit={apply} noValidate>
          <Input
            label="Tìm kiếm"
            placeholder="Tên, SĐT hoặc mã đặt chỗ"
            maxLength={100}
            value={draft.search}
            onChange={(e) => setDraft({ ...draft, search: e.target.value })}
          />
          <div className="field">
            <label className="field__label" htmlFor="refund-status">
              Trạng thái
            </label>
            <select
              id="refund-status"
              value={draft.status}
              onChange={(e) => {
                const parsed = refundFiltersSchema.shape.status.safeParse(
                  e.target.value,
                );
                if (parsed.success) setDraft({ ...draft, status: parsed.data });
              }}
            >
              <option value="all">Tất cả yêu cầu</option>
              {Object.entries(REFUND_STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="refund-level">
              Mức chính sách
            </label>
            <select
              id="refund-level"
              value={draft.level}
              onChange={(e) => {
                const parsed = refundFiltersSchema.shape.level.safeParse(
                  e.target.value,
                );
                if (parsed.success) setDraft({ ...draft, level: parsed.data });
              }}
            >
              <option value="all">Tất cả mức</option>
              {Object.entries(REFUND_LEVELS).map(([value, level]) => (
                <option key={value} value={value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Ngày yêu cầu"
            placeholder="DD/MM/YYYY"
            inputMode="numeric"
            maxLength={10}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={error || undefined}
          />
          <Button type="submit">Lọc kết quả</Button>
        </form>
        <section
          className="operator-refunds__policy"
          aria-label="Chính sách hủy vé"
        >
          <div>
            <h2>Danh sách yêu cầu hủy và tiến độ hoàn tiền</h2>
            <p>
              Ba mức được tính tự động theo policy 24h / 6h / 2h. Dưới 2h chuyển
              sang ngoại lệ.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => setDetail({ kind: "policy" })}
          >
            Xem policy 24h / 6h / 2h
          </Button>
        </section>
        <section
          className="operator-refunds__card"
          aria-labelledby="refund-list-title"
        >
          <h2 id="refund-list-title">Danh sách theo dõi</h2>
          {!appliedResult.success ? (
            <PageState
              title="Bộ lọc trên đường dẫn không hợp lệ"
              description="Đặt lại bộ lọc để tải danh sách yêu cầu."
              action={<Button onClick={reset}>Đặt lại bộ lọc</Button>}
            />
          ) : query.isPending ? (
            <PageState
              title="Đang tải yêu cầu"
              description="Vui lòng chờ trong giây lát."
            />
          ) : query.isError ? (
            <PageState
              title="Không tải được danh sách"
              description={query.error.message}
              action={
                <Button onClick={() => void query.refetch()}>Thử lại</Button>
              }
            />
          ) : items.length ? (
            <>
              <div
                className="operator-refunds__scroll"
                role="region"
                aria-label="Bảng yêu cầu hủy vé, có thể cuộn ngang"
                tabIndex={0}
              >
                <table>
                  <caption className="operator-refunds__sr-only">
                    Yêu cầu hủy vé và tiến độ hoàn tiền
                  </caption>
                  <colgroup>
                    {[180, 90, 120, 162, 126, 126, 114, 124, 128].map(
                      (width, index) => (
                        <col key={index} style={{ width }} />
                      ),
                    )}
                  </colgroup>
                  <thead>
                    <tr>
                      {[
                        "Khách hàng",
                        "Vé đặt / hủy",
                        "Xe",
                        "Chuyến",
                        "Yêu cầu hủy lúc",
                        "Xe khởi hành",
                        "Hủy trước",
                        "Mức chính sách",
                        "Xử lý",
                      ].map((label) => (
                        <th scope="col" key={label}>
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const minutes = cancellationMinutes(
                          item.requestedAt,
                          item.departureAt,
                        ),
                        level = REFUND_LEVELS[refundLevel(minutes)];
                      return (
                        <tr
                          key={item.bookingCode}
                          data-selected={
                            item.bookingCode === selected || undefined
                          }
                        >
                          <td>
                            <strong>{item.customer}</strong>
                            <small>{item.phone}</small>
                            <small>{item.bookingCode}</small>
                          </td>
                          <td>
                            <strong>
                              {item.bookedTickets} vé / {item.seats.length} vé
                            </strong>
                            <small>{item.seats.join(", ")}</small>
                          </td>
                          <td>
                            <strong>{item.plate}</strong>
                            <small>{item.vehicleType}</small>
                          </td>
                          <td>
                            <strong>{item.tripCode}</strong>
                            <small>{item.route}</small>
                          </td>
                          <td>
                            <strong>{requestTime(item.requestedAt)}</strong>
                            <small>Năm {item.requestedAt.slice(0, 4)}</small>
                          </td>
                          <td>
                            <strong>{requestTime(item.departureAt)}</strong>
                            <small>Năm {item.departureAt.slice(0, 4)}</small>
                          </td>
                          <td>
                            <strong className="operator-refunds__lead">
                              {refundLeadLabel(minutes)}
                            </strong>
                            <small>{leadDetail(item, minutes)}</small>
                          </td>
                          <td>
                            <strong>{level.label}</strong>
                            <small>{level.description}</small>
                          </td>
                          <td>
                            <Button
                              variant="secondary"
                              aria-label={`Xem chi tiết ${item.bookingCode}`}
                              onClick={() => {
                                setSelected(item.bookingCode);
                                navigate(
                                  `/operator/refund-requests/${encodeURIComponent(item.bookingCode)}?${new URLSearchParams({ returnTo: "/operator/refund-requests" + (params.toString() ? "?" + params.toString() : "") })}`,
                                );
                              }}
                            >
                              Xem chi tiết
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <footer className="operator-refunds__count">
                Hiển thị 1–{items.length} trong {query.data?.total ?? 0} yêu cầu
              </footer>
            </>
          ) : (
            <PageState
              title="Không có yêu cầu phù hợp"
              description="Thử thay đổi từ khóa, ngày hoặc bộ lọc."
              action={
                <Button variant="secondary" onClick={reset}>
                  Xóa bộ lọc
                </Button>
              }
            />
          )}
        </section>
      </main>
      <Dialog.Root
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-refunds__overlay" />
          <Dialog.Content
            className="operator-refunds__dialog"
            onOpenAutoFocus={() => {
              focusReturn.current =
                document.activeElement instanceof HTMLElement
                  ? document.activeElement
                  : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              focusReturn.current?.focus();
            }}
          >
            <Dialog.Title>
              {detail?.kind === "request"
                ? `Yêu cầu ${detail.item.bookingCode}`
                : "Policy 24h / 6h / 2h"}
            </Dialog.Title>
            <Dialog.Description>
              {detail?.kind === "request"
                ? "Thông tin yêu cầu hủy vé và tiến độ hoàn tiền minh họa."
                : "Mức chính sách tính theo thời gian từ lúc yêu cầu hủy đến lúc xe khởi hành."}
            </Dialog.Description>
            {detail?.kind === "request" ? (
              <RequestDetails item={detail.item} />
            ) : (
              <>
                <dl className="operator-refunds__facts">
                  {Object.values(REFUND_LEVELS).map((level) => (
                    <div key={level.label}>
                      <dt>{level.label}</dt>
                      <dd>{level.description}</dd>
                    </div>
                  ))}
                </dl>
                <p>
                  Dưới 2 giờ chuyển sang ngoại lệ. Mốc đúng 24h, 6h, 2h lần lượt
                  thuộc Mức 1, Mức 2, Mức 3.
                </p>
                <p className="operator-refunds__demo">
                  Màn hình này chưa cung cấp tỷ lệ hoặc số tiền hoàn.
                </p>
              </>
            )}
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                className="operator-refunds__close"
                aria-label="Đóng"
              >
                ×
              </Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
