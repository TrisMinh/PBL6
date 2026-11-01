import type { ReactElement } from "react";
import { useSessionClock } from "@/shared/lib/useSessionClock";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import {
  backendTicketSchema,
  bookingSchema,
  pageOf,
} from "@/shared/api/contracts";
import { ApiFailure, ResourcePage } from "@/shared/api/ResourcePage";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import { Button } from "@/shared/ui/Button/Button";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { readApiSession } from "@/shared/api/session";
import { stateLabel } from "@/shared/api/livePresentation";

export function BackendTicketsPage(): ReactElement {
  const [view, setView] = useState<"tickets" | "bookings">("tickets");
  const tabs = (
    <nav aria-label="Tài khoản đặt vé">
      <Button
        variant="secondary"
        aria-pressed={view === "tickets"}
        onClick={() => setView("tickets")}
      >
        Vé
      </Button>
      <Button
        variant="secondary"
        aria-pressed={view === "bookings"}
        onClick={() => setView("bookings")}
      >
        Đơn đặt vé
      </Button>
    </nav>
  );
  if (view === "bookings")
    return (
      <ResourcePage
        key={view}
        title="Đơn đặt vé của tôi"
        endpoint="/api/v1/bookings"
        columns={[
          { key: "code", label: "Mã đơn" },
          { key: "total", label: "Tổng tiền (VND)" },
          { key: "status", label: "Trạng thái" },
          {
            key: "checkout",
            label: "Thanh toán",
            render: (row) =>
              row.status === "PENDING_PAYMENT" ? (
                <Link to={`/payment/${row.id}/vnpay`}>Tiếp tục thanh toán</Link>
              ) : (
                "—"
              ),
          },
        ]}
      >
        {tabs}
      </ResourcePage>
    );
  return (
    <ResourcePage
      key={view}
      title="Vé của tôi"
      endpoint="/api/v1/tickets"
      columns={[
        {
          key: "publicCode",
          label: "Mã vé",
          render: (row) => (
            <Link to={`/tickets/${encodeURIComponent(String(row.id))}`}>
              {String(row.publicCode)}
            </Link>
          ),
        },
        { key: "passengerName", label: "Hành khách" },
        { key: "seatCode", label: "Ghế" },
        { key: "status", label: "Trạng thái" },
        { key: "issuedAt", label: "Ngày phát hành" },
      ]}
    >
      {tabs}
    </ResourcePage>
  );
}
export function BackendTicketDetailPage(): ReactElement {
  const { ticketCode = "" } = useParams();
  const query = useQuery({
    queryKey: ["live-api", readApiSession()?.user.id, "ticket", ticketCode],
    queryFn: async ({ signal }) => {
      const ticket = await apiJson(
        `/api/v1/tickets/${encodeURIComponent(ticketCode)}`,
        backendTicketSchema,
        { signal },
      );
      const trip = await getBackendTrip(ticket.tripId, signal);
      return { ticket, trip };
    },
    enabled: z.string().uuid().safeParse(ticketCode).success,
    retry: false,
  });
  if (!z.string().uuid().safeParse(ticketCode).success)
    return (
      <section className="live-api">
        <h1>Chi tiết vé</h1>
        <p>Vui lòng mở vé từ danh sách trong tài khoản.</p>
        <Link to="/account/tickets">Vé của tôi</Link>
      </section>
    );
  return (
    <section className="live-api">
      <h1>Chi tiết vé</h1>
      {query.isPending ? (
        <p role="status">Đang tải…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <dl>
            <dt>Mã vé</dt>
            <dd>{query.data.ticket.publicCode}</dd>
            <dt>Hành khách</dt>
            <dd>{query.data.ticket.passengerName}</dd>
            <dt>Ghế</dt>
            <dd>{query.data.ticket.seatCode}</dd>
            <dt>Trạng thái</dt>
            <dd>{stateLabel(query.data.ticket.status)}</dd>
            <dt>Hành trình</dt>
            <dd>
              {query.data.trip.origin} → {query.data.trip.destination}
            </dd>
            <dt>Khởi hành</dt>
            <dd>
              {new Date(query.data.trip.departureAt).toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
              })}
            </dd>
          </dl>
          {query.data.ticket.status === "ISSUED" && (
            <Link to={`/bookings/${query.data.ticket.bookingId}/cancel`}>
              Xem chính sách hủy vé
            </Link>
          )}
        </>
      )}
    </section>
  );
}

const previewSchema = z.object({
  previewId: z.string().uuid(),
  ticketIds: z.array(z.string()),
  policyVersion: z.string(),
  fee: z.number(),
  refundAmount: z.number(),
  currency: z.literal("VND"),
  expiresAt: z.string(),
});
export function BackendCancellationPage(): ReactElement {
  const { bookingCode = "" } = useParams();
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [attempt] = useState(() => crypto.randomUUID());
  const [previewKey, setPreviewKey] = useState(() => crypto.randomUUID());
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [
      "live-api",
      readApiSession()?.user.id,
      "cancellation",
      bookingCode,
    ],
    queryFn: async ({ signal }) => {
      const booking = await apiJson(
        `/api/v1/bookings/${encodeURIComponent(bookingCode)}`,
        bookingSchema,
        { signal },
      );
      const tickets: z.infer<typeof backendTicketSchema>[] = [];
      let page = 0;
      for (;;) {
        const result = await apiJson(
          `/api/v1/tickets?page=${page}&size=100`,
          pageOf(backendTicketSchema),
          { signal },
        );
        tickets.push(
          ...result.items.filter((ticket) => ticket.bookingId === booking.id),
        );
        if (++page >= result.totalPages) break;
      }
      return { booking, tickets };
    },
    enabled: z.string().uuid().safeParse(bookingCode).success,
    retry: false,
  });
  const preview = useMutation({
    mutationFn: () =>
      apiJson(
        `/api/v1/bookings/${bookingCode}/cancellation-preview`,
        previewSchema,
        {
          method: "POST",
          body: { ticketIds: selected },
          idempotencyKey: previewKey,
        },
      ),
    retry: false,
  });
  const cancel = useMutation({
    mutationFn: () =>
      apiJson(
        `/api/v1/bookings/${bookingCode}/cancel`,
        z.object({ operationId: z.string(), status: z.string() }),
        {
          method: "POST",
          body: {
            previewId: preview.data?.previewId,
            reason,
            expectedVersion: query.data?.booking.rowVersion,
          },
          idempotencyKey: `${preview.data?.previewId ?? attempt}-cancel`,
        },
      ),
    retry: false,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["live-api"] });
    },
  });
  const now = useSessionClock(preview.data?.expiresAt);
  if (!z.string().uuid().safeParse(bookingCode).success)
    return <p role="alert">Vui lòng mở chức năng hủy từ vé trong tài khoản.</p>;
  return (
    <section className="live-api">
      <h1>Hủy vé</h1>
      {query.isPending ? (
        <p role="status">Đang tải…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p>
            Đơn {query.data.booking.code}. Phí hủy được tính theo chính sách
            hiện hành.
          </p>
          {query.data.tickets
            .filter((t) => t.status === "ISSUED")
            .map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(t.id)}
                  disabled={
                    cancel.isPending || cancel.isSuccess || preview.isPending
                  }
                  onChange={() => {
                    setSelected((ids) =>
                      ids.includes(t.id)
                        ? ids.filter((id) => id !== t.id)
                        : [...ids, t.id],
                    );
                    setPreviewKey(crypto.randomUUID());
                    preview.reset();
                  }}
                />
                {t.passengerName} · ghế {t.seatCode}
              </label>
            ))}
          <Button
            disabled={!selected.length || preview.isPending || cancel.isSuccess}
            onClick={() => preview.mutate()}
          >
            Tính phí hủy
          </Button>
          {preview.data && (
            <>
              <p>
                Phí: {formatCurrencyVnd(preview.data.fee)} · Hoàn lại:{" "}
                {formatCurrencyVnd(preview.data.refundAmount)}
              </p>
              <label>
                Lý do hủy
                <textarea
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              <Button
                isLoading={cancel.isPending}
                disabled={
                  !reason.trim() ||
                  cancel.isSuccess ||
                  now === null ||
                  Date.parse(preview.data.expiresAt) <= now
                }
                onClick={() => cancel.mutate()}
              >
                Xác nhận hủy các vé đã chọn
              </Button>
            </>
          )}
        </>
      )}
      {preview.isError && <ApiFailure error={preview.error} />}
      {cancel.isError && <ApiFailure error={cancel.error} />}
      {cancel.isSuccess && (
        <p role="status">
          Yêu cầu hủy đã được tiếp nhận. Việc hoàn tiền sẽ được xử lý theo trạng
          thái của hệ thống.
        </p>
      )}
      <Link to="/account/tickets">Vé của tôi</Link>
    </section>
  );
}
