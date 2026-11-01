import { useEffect, useState, type ReactElement } from "react";
import { Link } from "react-router";

import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import type { MockSession } from "@/features/auth/types/auth";
import { clearMockSession } from "@/features/auth/lib/sessionStorage";
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

function TicketList({
  items,
}: {
  items: readonly TicketDetail[];
}): ReactElement {
  return (
    <ul className="account-tickets__list">
      {items.map((ticket) => (
        <li key={ticket.ticketCode} className="account-tickets__item">
          <article>
            <StatusBadge
              tone={ticket.status === "issued" ? "success" : "error"}
            >
              {ticket.status === "issued" ? "Đã phát hành" : "Đã hủy"}
            </StatusBadge>
            <h2>
              {ticket.trip.origin.name} → {ticket.trip.destination.name}
            </h2>
            <p>
              {formatDateTime(ticket.trip.departureTime)} · Ghế{" "}
              {ticket.seatCode}
            </p>
            <p>
              {ticket.passenger.fullName} · {formatCurrencyVnd(ticket.fareVnd)}
            </p>
            <Link to={ticketPath(ticket.ticketCode)}>
              Xem vé {ticket.ticketCode}
            </Link>
            {ticket.status === "issued" ? (
              <Link to={bookingCancellationPath(ticket.bookingCode)}>
                Hủy vé
              </Link>
            ) : null}
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
    <>
      <p>{query.data.total} vé</p>
      <TicketList items={query.data.items} />
    </>
  );
}
function AccountHeader({ onLogout }: { onLogout: () => void }): ReactElement {
  return (
    <header className="account-tickets__heading">
      <h1>Vé của tôi</h1>
      <p>Lịch sử vé thuộc tài khoản mô phỏng của bạn.</p>
      <Button variant="secondary" onClick={onLogout}>
        Đăng xuất
      </Button>
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
      <AccountHeader
        onLogout={() => {
          revoke();
          clearMockSession();
        }}
      />
      <StatusFilter status={status} onChange={setStatus} />
      {session?.token ? (
        <History session={session} revoke={revoke} status={status} />
      ) : (
        <p role="status">Đang kiểm tra phiên…</p>
      )}
    </section>
  );
}
