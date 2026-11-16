import { useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Rows } from "@phosphor-icons/react/dist/csr/Rows";
import { GridNine } from "@phosphor-icons/react/dist/csr/GridNine";
import { SquaresFour } from "@phosphor-icons/react/dist/csr/SquaresFour";
import { apiJson } from "@/shared/api/client";
import {
  backendTicketSchema,
  bookingSchema,
  pageOf,
} from "@/shared/api/contracts";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { stateLabel } from "@/shared/api/livePresentation";
import {
  getBackendTrip,
  toTrip,
} from "@/features/trips/repositories/backendTripRepository";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import {
  defaultTicketView,
  readCustomerData,
  saveCustomerData,
  ticketViewSchema,
  type TicketView,
} from "@/features/account/customerPreferences";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { Toast } from "@/shared/ui/Toast/Toast";
import {
  TicketList,
  StatusFilter,
  type TicketListItem,
} from "./AccountTicketsPage";
import type { TicketHistoryFilter } from "../repositories/ticketRepository";

export function LiveAccountTickets(): ReactElement {
  const { session } = useAccountSession();
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState<TicketHistoryFilter>("issued");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<TicketView>(() =>
    readCustomerData(
      session?.userId ?? "",
      "ticket-view",
      ticketViewSchema,
      defaultTicketView,
    ),
  );
  const query = useQuery({
    queryKey: liveQueryKey("styled-account-tickets", page),
    queryFn: async ({ signal }) => {
      const response = await apiJson(
        `/api/v1/tickets?page=${page}&size=12`,
        pageOf(backendTicketSchema),
        { signal },
      );
      const trips = new Map(
        [...new Set(response.items.map((ticket) => ticket.tripId))].map(
          (id) => [id, getBackendTrip(id, signal)],
        ),
      );
      const bookings = new Map(
        [...new Set(response.items.map((ticket) => ticket.bookingId))].map(
          (id) => [
            id,
            apiJson(`/api/v1/bookings/${id}`, bookingSchema, { signal }),
          ],
        ),
      );
      const items: TicketListItem[] = await Promise.all(
        response.items.map(async (ticket) => {
          const tripRequest = trips.get(ticket.tripId);
          const bookingRequest = bookings.get(ticket.bookingId);
          if (!tripRequest || !bookingRequest)
            throw new Error("Không thể tải thông tin chuyến.");
          const [trip, booking] = await Promise.all([
            tripRequest,
            bookingRequest,
          ]);
          return {
            ticketCode: ticket.publicCode,
            bookingCode: booking.code,
            trip: {
              ...toTrip(trip),
              departureTime: new Date(trip.departureAt).toISOString(),
              arrivalTime: new Date(trip.arrivalAt).toISOString(),
            },
            seatCode: ticket.seatCode,
            passenger: { fullName: ticket.passengerName },
            fareVnd: trip.fare.amount,
            status:
              ticket.status === "ISSUED" || ticket.status === "CHECKED_IN"
                ? "issued"
                : "cancelled",
            statusLabel: stateLabel(ticket.status),
            canCancel: ticket.status === "ISSUED",
            href: `/tickets/${ticket.id}`,
            cancelHref: `/bookings/${ticket.bookingId}/cancel`,
          };
        }),
      );
      return { ...response, items };
    },
    retry: false,
  });
  function changeView(next: TicketView): void {
    setView(next);
    if (session && !saveCustomerData(session.userId, "ticket-view", next))
      setNotice("Đã đổi cách hiển thị nhưng chưa lưu được tùy chọn.");
  }
  if (query.isPending) return <p role="status">Đang tải danh sách vé…</p>;
  if (query.isError)
    return (
      <PageState
        title="Chưa thể tải danh sách vé"
        description="Vui lòng kiểm tra kết nối rồi thử lại."
        action={<Button onClick={() => void query.refetch()}>Thử lại</Button>}
      />
    );
  const visible = query.data.items.filter(
    (ticket) => status === "all" || ticket.status === status,
  );
  return (
    <div
      className="account-tickets__results"
      data-layout={view.layout}
      data-size={view.layout === "list" ? "medium" : view.size}
    >
      <div className="account-tickets__toolbar">
        <h2>Danh sách vé</h2>
        <StatusFilter status={status} onChange={setStatus} />
      </div>
      <div className="account-tickets__view-toolbar">
        <p role="status">
          {query.data.totalElements} vé · {visible.length} vé hiển thị
        </p>
        <div
          className="account-tickets__segmented"
          role="group"
          aria-label="Kiểu hiển thị vé"
        >
          {(
            [
              ["list", "medium", "Danh sách", Rows],
              ["grid", "small", "Lưới nhỏ", GridNine],
              ["grid", "large", "Lưới lớn", SquaresFour],
            ] as const
          ).map(([layout, size, label, Icon]) => (
            <button
              type="button"
              key={label}
              aria-label={label}
              title={label}
              aria-pressed={
                view.layout === layout &&
                (layout === "list" || view.size === size)
              }
              onClick={() => changeView({ layout, size })}
            >
              <Icon size={19} aria-hidden />
            </button>
          ))}
        </div>
      </div>
      {notice && (
        <Toast tone="error" message={notice} onClose={() => setNotice("")} />
      )}
      {visible.length ? (
        <TicketList
          items={visible}
          showPhotos={view.layout === "list" || view.size !== "small"}
        />
      ) : (
        <div className="account-tickets__empty">
          <p>Chưa có vé ở trạng thái đã chọn.</p>
          <Link className="button button--primary" to="/trips">
            Tìm chuyến xe
          </Link>
        </div>
      )}
      {query.data.totalPages > 1 && (
        <nav className="account-live__pagination" aria-label="Phân trang vé">
          <Button
            variant="secondary"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            Trước
          </Button>
          <span>
            Trang {page + 1} / {query.data.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page + 1 >= query.data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Sau
          </Button>
        </nav>
      )}
    </div>
  );
}
