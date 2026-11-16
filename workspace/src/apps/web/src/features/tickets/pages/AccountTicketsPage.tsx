import { Toast } from "@/shared/ui/Toast/Toast";
import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Ticket } from "@phosphor-icons/react/dist/csr/Ticket";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { GridNine } from "@phosphor-icons/react/dist/csr/GridNine";
import { Rows } from "@phosphor-icons/react/dist/csr/Rows";
import { ExploreImage } from "@/features/explore/ExploreImage";
import { catalogueArtwork } from "@/features/explore/liveCataloguePresentation";
import type { Trip } from "@/features/trips/types/trip";
import {
  defaultTicketView,
  readCustomerData,
  saveCustomerData,
  ticketViewSchema,
  type TicketView,
} from "@/features/account/customerPreferences";

import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import type { MockSession } from "@/features/auth/types/auth";
import { useAccountTickets } from "@/features/tickets/hooks/useAccountTickets";
import type { TicketDetail } from "@/features/tickets/types/ticketAccess";
import type { TicketHistoryFilter } from "@/features/tickets/repositories/ticketRepository";
import { ticketHistoryFilterSchema } from "@/features/tickets/schemas/ticket.schema";
import {
  ROUTES,
  bookingCancellationPath,
  ticketPath,
} from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { StatusBadge } from "@/shared/ui/StatusBadge/StatusBadge";
import { PageState } from "@/shared/ui/PageState/PageState";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { formatDateTime } from "@/shared/lib/formatDateTime";

import "./AccountTicketsPage.css";

export type TicketListItem = Pick<
  TicketDetail,
  "ticketCode" | "status" | "seatCode" | "passenger" | "fareVnd" | "bookingCode"
> & {
  trip: Trip;
  href?: string;
  cancelHref?: string;
  canCancel?: boolean;
  statusLabel?: string;
};
export function TicketList({
  items,
  showPhotos,
}: {
  items: readonly TicketListItem[];
  showPhotos: boolean;
}): ReactElement {
  return (
    <ul className="account-tickets__list">
      {items.map((ticket) => (
        <li key={ticket.ticketCode} className="account-tickets__item">
          <article>
            <div className="account-tickets__meta">
              <code>{ticket.ticketCode}</code>
              <StatusBadge
                tone={ticket.status === "issued" ? "success" : "error"}
              >
                {ticket.statusLabel ??
                  (ticket.status === "issued" ? "Đã phát hành" : "Đã hủy")}
              </StatusBadge>
            </div>
            <div className="account-tickets__destination">
              <h2>
                {ticket.trip.origin.displayName}{" "}
                <ArrowRight size={18} aria-hidden />{" "}
                {ticket.trip.destination.displayName}
              </h2>
              {showPhotos && (
                <div className="account-tickets__photo" aria-hidden="true">
                  <ExploreImage
                    art={
                      ticket.href
                        ? catalogueArtwork(ticket.trip.destination.displayName)
                        : [
                            "cities",
                            (
                              {
                                "loc-hcm": 0,
                                "loc-dalat": 1,
                                "loc-danang": 2,
                                "loc-hanoi": 3,
                              } as Record<string, number>
                            )[ticket.trip.destination.id] ?? 0,
                          ]
                    }
                  />
                </div>
              )}
            </div>
            <div className="account-tickets__content">
              <dl className="account-tickets__facts">
                <div>
                  <dt>Khởi hành</dt>
                  <dd>
                    <time dateTime={ticket.trip.departureTime}>
                      {formatDateTime(ticket.trip.departureTime, "HH:mm")}
                      <span className="account-tickets__date">
                        {formatDateTime(
                          ticket.trip.departureTime,
                          "dd/MM/yyyy",
                        )}
                      </span>
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>Nhà xe</dt>
                  <dd>
                    {ticket.trip.displayOperatorName ||
                      ticket.trip.operator.name}
                  </dd>
                </div>
                <div>
                  <dt>Ghế</dt>
                  <dd>{ticket.seatCode}</dd>
                </div>
                <div>
                  <dt>Hành khách</dt>
                  <dd>{ticket.passenger.fullName}</dd>
                </div>
              </dl>
              <div className="account-tickets__purchase">
                <p className="account-tickets__price">
                  <span>Giá vé</span>
                  <strong>{formatCurrencyVnd(ticket.fareVnd)}</strong>
                </p>
                <div className="account-tickets__actions">
                  <Link
                    className="account-tickets__view"
                    to={ticket.href ?? ticketPath(ticket.ticketCode)}
                    aria-label={`Xem vé ${ticket.ticketCode}`}
                  >
                    Xem vé <ArrowRight size={16} aria-hidden />
                  </Link>
                  {ticket.status === "issued" && ticket.canCancel !== false && (
                    <Link
                      className="account-tickets__cancel"
                      to={
                        ticket.cancelHref ??
                        bookingCancellationPath(ticket.bookingCode)
                      }
                    >
                      Hủy vé
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
function History({
  session,
  revoke,
  status,
}: {
  session: MockSession;
  revoke: () => void;
  status: TicketHistoryFilter;
}): ReactElement {
  const query = useAccountTickets(session, status);
  const [view, setView] = useState<TicketView>(() => {
    const saved = readCustomerData(
      session.userId,
      "ticket-view",
      ticketViewSchema,
      defaultTicketView,
    );
    return { ...saved, size: saved.size === "medium" ? "large" : saved.size };
  });
  const [viewError, setViewError] = useState(false);
  function changeView(next: TicketView): void {
    setView(next);
    setViewError(!saveCustomerData(session.userId, "ticket-view", next));
  }
  useEffect(() => {
    if (query.error && [401, 410].includes(query.error.status)) revoke();
  }, [query.error, revoke]);
  if (query.isPending) return <p role="status">Đang tải danh sách vé…</p>;
  if (query.isError)
    return (
      <PageState
        title="Chưa thể tải danh sách vé"
        description="Kiểm tra kết nối hoặc đăng nhập lại."
        action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
      />
    );
  if (!query.data.items.length)
    return (
      <div className="account-tickets__empty">
        <p>
          {status === "issued"
            ? "Bạn chưa có vé đã phát hành."
            : "Không có vé ở trạng thái đã chọn."}
        </p>
        <Link to={ROUTES.home}>Tìm chuyến</Link>
      </div>
    );
  return (
    <div
      className="account-tickets__results"
      data-layout={view.layout}
      data-size={view.layout === "list" ? "medium" : view.size}
    >
      <div className="account-tickets__view-toolbar">
        <p className="account-tickets__total" role="status">
          {query.data.total} vé
        </p>
        <div className="account-tickets__view-options">
          <div
            className="account-tickets__segmented"
            role="group"
            aria-label="Kiểu hiển thị vé"
          >
            <button
              type="button"
              aria-label="Danh sách"
              title="Danh sách"
              aria-pressed={view.layout === "list"}
              onClick={() => changeView({ ...view, layout: "list" })}
            >
              <Rows size={19} aria-hidden />
            </button>
            {(
              [
                ["small", "Lưới nhỏ", GridNine],
                ["large", "Lưới lớn", SquaresFour],
              ] as const
            ).map(([size, label, Icon]) => (
              <button
                type="button"
                key={size}
                aria-label={label}
                title={label}
                aria-pressed={view.layout === "grid" && view.size === size}
                onClick={() => changeView({ layout: "grid", size })}
              >
                <Icon size={19} aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>
      {viewError && (
        <Toast
          tone="error"
          message="Đã đổi cách hiển thị. Chưa lưu được tùy chọn trên trình duyệt."
          onClose={() => setViewError(false)}
        />
      )}
      <TicketList items={query.data.items} showPhotos />
    </div>
  );
}
export function AccountHeader(): ReactElement {
  return (
    <header className="account-tickets__heading">
      <div className="account-tickets__intro">
        <span className="account-tickets__heading-icon">
          <Ticket size={30} weight="duotone" aria-hidden />
        </span>
        <div>
          <h1>Vé của tôi</h1>
          <p>Xem vé điện tử và trạng thái các chuyến đã đặt.</p>
        </div>
      </div>
    </header>
  );
}
function StatusFilter({
  status,
  onChange,
}: {
  status: TicketHistoryFilter;
  onChange: (status: TicketHistoryFilter) => void;
}): ReactElement {
  return (
    <label className="account-tickets__filter">
      Trạng thái vé
      <select
        value={status}
        onChange={(event) => {
          const parsed = ticketHistoryFilterSchema.safeParse(
            event.target.value,
          );
          if (parsed.success) onChange(parsed.data);
        }}
      >
        <option value="all">Tất cả</option>
        <option value="issued">Đã phát hành</option>
        <option value="cancelled">Đã hủy</option>
      </select>
    </label>
  );
}
export function AccountTicketsPage(): ReactElement {
  const { session, revoke } = useAccountSession();
  const [status, setStatus] = useState<TicketHistoryFilter>("issued");
  return (
    <section className="account-tickets">
      <AccountHeader />
      <div className="account-tickets__toolbar">
        <h2>Danh sách vé</h2>
        <StatusFilter status={status} onChange={setStatus} />
      </div>
      {session?.token ? (
        <History
          key={session.userId}
          session={session}
          revoke={revoke}
          status={status}
        />
      ) : (
        <p role="status">Đang kiểm tra phiên…</p>
      )}
    </section>
  );
}
