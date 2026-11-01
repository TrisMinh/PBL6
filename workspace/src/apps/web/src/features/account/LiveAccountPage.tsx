import { useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { apiJson } from "@/shared/api/client";
import {
  backendTicketSchema,
  bookingSchema,
  pageOf,
} from "@/shared/api/contracts";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { LiveProfileCard } from "./LiveProfileCard";
import "./LiveAccountPage.css";

const labels: Record<string, string> = {
  ISSUED: "Sẵn sàng khởi hành",
  CHECKED_IN: "Đã lên xe",
  CANCELLED: "Đã hủy",
  EXPIRED: "Đã hết hạn",
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  COMPLETED: "Đã hoàn thành",
  REFUNDED: "Đã hoàn tiền",
};
function Status({ value }: { value: string }): ReactElement {
  return (
    <span
      className={`account-live__status account-live__status--${value.toLowerCase()}`}
    >
      {labels[value] ?? value}
    </span>
  );
}

function AccountList({ view }: { view: "tickets" | "bookings" }): ReactElement {
  const [page, setPage] = useState(0);
  const query = useQuery({
    queryKey: liveQueryKey("account-list", view, page),
    queryFn: async ({ signal }) => {
      const path = `/api/v1/${view}?page=${page}&size=12`;
      if (view === "tickets") {
        const result = await apiJson(path, pageOf(backendTicketSchema), {
          signal,
        });
        return {
          ...result,
          cards: result.items.map((ticket) => ({
            id: ticket.id,
            code: ticket.publicCode,
            status: ticket.status,
            title: ticket.passengerName,
            detail: `Ghế ${ticket.seatCode}`,
            href: `/tickets/${encodeURIComponent(ticket.id)}`,
            action: "Xem vé",
            date: ticket.issuedAt,
          })),
        };
      }
      const result = await apiJson(path, pageOf(bookingSchema), { signal });
      return {
        ...result,
        cards: result.items.map((booking) => ({
          id: booking.id,
          code: booking.code,
          status: booking.status,
          title: booking.contact.fullName,
          detail: `${booking.items.length} hành khách · ${formatCurrencyVnd(booking.total)}`,
          href:
            booking.status === "PENDING_PAYMENT"
              ? `/payment/${booking.id}/vnpay`
              : `/bookings/${booking.id}/cancel`,
          action:
            booking.status === "PENDING_PAYMENT"
              ? "Thanh toán ngay"
              : "Xem đơn & chính sách hủy",
          date: "",
        })),
      };
    },
    retry: false,
  });
  if (query.isPending)
    return (
      <div className="account-live__loading" role="status">
        Đang tải {view === "tickets" ? "vé" : "đơn đặt vé"} của bạn…
      </div>
    );
  if (query.isError)
    return (
      <ApiFailure error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data.cards.length)
    return (
      <div className="account-live__empty">
        <span className="account-live__empty-icon" aria-hidden="true">
          <svg viewBox="0 0 48 48" fill="none">
            <path
              d="M8 13h32v8a4 4 0 0 0 0 8v8H8v-8a4 4 0 0 0 0-8v-8Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M29 14v5m0 5v3m0 5v4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <h3>
          {view === "tickets"
            ? "Chuyến đi tiếp theo đang chờ bạn"
            : "Bạn chưa có đơn đặt vé nào"}
        </h3>
        <p>
          {view === "tickets"
            ? "Vé của bạn sẽ xuất hiện tại đây sau khi đặt vé thành công."
            : "Tìm một hành trình phù hợp và quản lý mọi đơn đặt vé ngay tại đây."}
        </p>
        <Link className="button button--primary" to="/">
          Tìm chuyến xe
        </Link>
      </div>
    );
  return (
    <>
      <div className="account-live__cards">
        {query.data.cards.map((card) => (
          <article className="account-live__ticket" key={card.id}>
            <div className="account-live__ticket-top">
              <span className="account-live__code">{card.code}</span>
              <Status value={card.status} />
            </div>
            <h3>{card.title}</h3>
            <p>{card.detail}</p>
            <div className="account-live__ticket-bottom">
              {card.date && (
                <time dateTime={card.date}>
                  Phát hành{" "}
                  {new Date(card.date).toLocaleDateString("vi-VN", {
                    timeZone: "Asia/Ho_Chi_Minh",
                  })}
                </time>
              )}
              <Link to={card.href}>
                {card.action} <span aria-hidden="true">→</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
      {query.data.totalPages > 1 && (
        <nav className="account-live__pagination" aria-label="Phân trang">
          <Button
            variant="secondary"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Trước
          </Button>
          <span>
            Trang {page + 1} / {query.data.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page + 1 >= query.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau
          </Button>
        </nav>
      )}
    </>
  );
}

export function LiveAccountPage(): ReactElement {
  const { revoke } = useAccountSession();
  const [view, setView] = useState<"tickets" | "bookings">("tickets");
  return (
    <div className="account-live">
      <header className="account-live__heading">
        <div>
          <p className="account-live__eyebrow">TÀI KHOẢN CỦA BẠN</p>
          <h1>Những hành trình của tôi</h1>
          <p>Thông tin cá nhân và mọi chuyến đi, ở cùng một nơi.</p>
        </div>
        <div className="account-live__actions">
          <Button variant="ghost" onClick={revoke}>
            Đăng xuất <span aria-hidden="true">↗</span>
          </Button>
        </div>
      </header>
      <div className="account-live__layout">
        <aside className="account-live__sidebar">
          <LiveProfileCard />
        </aside>
        <section
          className="account-live__journeys"
          aria-labelledby="account-journeys-title"
        >
          <header className="account-live__section-heading">
            <h2 id="account-journeys-title">Lịch sử đặt vé</h2>
            <p>Xem vé và theo dõi trạng thái đơn của bạn.</p>
          </header>
          <div
            className="account-live__tabs"
            role="group"
            aria-label="Loại danh sách"
          >
            <button
              type="button"
              aria-pressed={view === "tickets"}
              onClick={() => setView("tickets")}
            >
              Vé của tôi
            </button>
            <button
              type="button"
              aria-pressed={view === "bookings"}
              onClick={() => setView("bookings")}
            >
              Đơn đặt vé
            </button>
          </div>
          <AccountList key={view} view={view} />
        </section>
      </div>
    </div>
  );
}
