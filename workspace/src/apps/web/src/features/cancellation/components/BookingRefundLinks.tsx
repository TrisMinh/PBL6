import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { Link } from "react-router";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { backendTicketSchema, pageOf } from "@/shared/api/contracts";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import {
  isRefundPending,
  REFUND_REFRESH_INTERVAL_MS,
  refundSchema,
  refundStatusLabel,
  type LiveRefund,
} from "../schemas/liveRefund";
import { ROUTES } from "@/shared/config/routes";
import { RefundStatusCard } from "./RefundStatusCard";
import "@/shared/ui/Button/Button.css";
import "./BookingRefundLinks.css";

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});
const refundDate = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});
const ticketSeatsSchema = z.array(
  backendTicketSchema.pick({ seatCode: true, refundRequestId: true }),
);

function matchesRefundRequest(refund: LiveRefund, requestId: string): boolean {
  return (
    refund.refundRequestId === requestId ||
    refund.refundReference === `EVENT-${requestId.replaceAll("-", "")}`
  );
}

export function BookingRefundLinks({
  bookingId,
  waiting,
  history = false,
  empty = null,
  blockedOrderTotal,
  requestReference,
  ticketRefundRequestId,
  animateRequest = false,
}: {
  bookingId: string;
  waiting: boolean;
  history?: boolean;
  empty?: ReactElement | null;
  blockedOrderTotal?: number;
  requestReference?: string;
  ticketRefundRequestId?: string;
  animateRequest?: boolean;
}): ReactElement | null {
  const [showOlder, setShowOlder] = useState(false);
  const [selectedId, setSelectedId] = useState<string>();
  const matchesTicket = (refund: LiveRefund): boolean =>
    !!ticketRefundRequestId &&
    matchesRefundRequest(refund, ticketRefundRequestId);
  const query = useQuery({
    queryKey: liveQueryKey("booking-refunds", bookingId),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/refunds?bookingId=${encodeURIComponent(bookingId)}`,
        pageOf(refundSchema),
        { signal },
      ),
    refetchInterval: (result) => {
      const items = result.state.data?.items;
      const pending = items?.some((refund) => isRefundPending(refund.status));
      const awaitingRequest =
        requestReference &&
        !items?.some((refund) => refund.refundReference === requestReference);
      const awaitingTicketRefund =
        ticketRefundRequestId && !items?.some(matchesTicket);
      return pending ||
        awaitingRequest ||
        awaitingTicketRefund ||
        (waiting && !items?.length)
        ? REFUND_REFRESH_INTERVAL_MS
        : false;
    },
    refetchIntervalInBackground: true,
    staleTime: 0,
    retry: false,
  });
  const ticketSeats = useQuery({
    queryKey: liveQueryKey("booking-refund-seats", bookingId),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${encodeURIComponent(bookingId)}/tickets`,
        ticketSeatsSchema,
        { signal },
      ),
    enabled: history && showOlder,
    retry: false,
  });
  if (query.isError && !query.data)
    return (
      <ApiFailure error={query.error} retry={() => void query.refetch()} />
    );
  if (
    !requestReference &&
    !ticketRefundRequestId &&
    !waiting &&
    !query.isPending &&
    !query.data?.items.length
  )
    return empty;
  const bookingRefunds = query.data?.items ?? [];
  const ticketRefund = ticketRefundRequestId
    ? bookingRefunds.find(matchesTicket)
    : undefined;
  if (ticketRefundRequestId && !ticketRefund)
    return (
      <p className="booking-refunds__item" role="status">
        Đang đối chiếu khoản hoàn của vé…
      </p>
    );
  const items = ticketRefund ? [ticketRefund] : bookingRefunds;
  const latest = requestReference
    ? items.find((refund) => refund.refundReference === requestReference)
    : items[0];
  const selected = items.find((refund) => refund.id === selectedId) ?? latest;
  const olderCount = items.length - 1;
  const content =
    history && latest && selected ? (
      <>
        <RefundStatusCard
          key={selected.id}
          refund={selected}
          animateOnMount={animateRequest && selectedId === undefined}
        />
        {olderCount > 0 && (
          <button
            type="button"
            className="button button--secondary booking-refunds-history__toggle"
            aria-expanded={showOlder}
            onClick={() => {
              if (showOlder) setSelectedId(latest.id);
              setShowOlder(!showOlder);
            }}
          >
            {showOlder
              ? "Thu gọn lịch sử hoàn tiền"
              : `Xem lịch sử hoàn tiền (${olderCount})`}
          </button>
        )}
        {showOlder && olderCount > 0 && (
          <ul className="booking-refunds" aria-label="Lịch sử hoàn tiền">
            {items.map((refund) => {
              const seats = ticketSeats.data
                ?.filter(
                  (ticket) =>
                    ticket.refundRequestId &&
                    matchesRefundRequest(refund, ticket.refundRequestId),
                )
                .map((ticket) => ticket.seatCode);
              return (
                <li key={refund.id}>
                  <button
                    type="button"
                    className="booking-refunds__item booking-refunds__history-item"
                    aria-pressed={selected.id === refund.id}
                    onClick={() => setSelectedId(refund.id)}
                  >
                    <span className="booking-refunds__details">
                      <strong>{money.format(refund.amount)}</strong>
                      {!!seats?.length && (
                        <span className="booking-refunds__seats">
                          Ghế {seats.join(", ")}
                        </span>
                      )}
                      <span
                        className="booking-refunds__status"
                        data-status={refund.status}
                      >
                        {refundStatusLabel(
                          refund.status,
                          refund.paymentProvider,
                        )}
                      </span>
                      <span className="booking-refunds__reference">
                        {refund.createdAt && (
                          <>
                            {refundDate.format(new Date(refund.createdAt))}{" "}
                            ·{" "}
                          </>
                        )}
                        {refund.refundReference}
                      </span>
                    </span>
                    <span
                      className="booking-refunds__history-action"
                      aria-hidden="true"
                    >
                      {selected.id === refund.id ? "Đang xem" : "Xem chi tiết"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </>
    ) : !history && items.length ? (
      <ul
        className="booking-refunds"
        aria-label={
          ticketRefundRequestId
            ? "Hoàn tiền của vé"
            : "Các khoản hoàn tiền của đơn"
        }
      >
        {items.map((refund) => (
          <li key={refund.id} className="booking-refunds__item">
            <div className="booking-refunds__details">
              <strong>Hoàn tiền {money.format(refund.amount)}</strong>
              <span
                className="booking-refunds__status"
                data-status={refund.status}
                aria-live="polite"
              >
                {refundStatusLabel(refund.status, refund.paymentProvider)}
              </span>
              <span className="booking-refunds__reference">
                Mã hoàn tiền {refund.refundReference}
              </span>
            </div>
            <Link
              className="button button--primary booking-refunds__action"
              to={`/refunds/${refund.id}`}
            >
              Theo dõi hoàn tiền <ArrowRight size={16} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    ) : waiting || history ? (
      <p role="status">
        {query.isPending
          ? "Đang tải trạng thái hoàn tiền…"
          : "Hồ sơ hoàn tiền đang được tạo. Trạng thái sẽ tự cập nhật."}
      </p>
    ) : null;

  return history ? (
    <section className="booking-refunds-history">
      <header className="booking-refunds-history__heading">
        <h1>Theo dõi hoàn tiền</h1>
        <Link className="button button--secondary" to={ROUTES.accountTickets}>
          Về vé của tôi
        </Link>
      </header>
      {blockedOrderTotal !== undefined && (
        <p>
          {items
            .filter((item) => item.status === "SUCCEEDED")
            .reduce((sum, item) => sum + item.amount, 0) >= blockedOrderTotal
            ? "Đơn đã hoàn đủ số tiền đã thanh toán. Không thể yêu cầu hủy thêm vé."
            : "Đơn có khoản hoàn trước đó. Hiện chưa thể hủy thêm vé của đơn này."}
        </p>
      )}
      {content}
    </section>
  ) : (
    content
  );
}
