import { useEffect, useState, type ReactElement } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import {
  bookingSchema,
  backendTicketSchema,
  pageOf,
} from "@/shared/api/contracts";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { readApiSession } from "@/shared/api/session";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import { CancellationSelector } from "../components/CancellationSelector/CancellationSelector";
import { CancellationConfirmDialog } from "../components/CancellationConfirmDialog/CancellationConfirmDialog";
import { Heading, JourneyCard } from "./CancellationPage";
import { Button } from "@/shared/ui/Button/Button";
import bus from "@/assets/cancellation/bus.svg";
import policy from "@/assets/cancellation/policy.svg";
import quoteIcon from "@/assets/cancellation/quote.svg";
import verified from "@/assets/cancellation/verified.svg";
import "./LiveCancellationPage.css";

const previewSchema = z.object({
  previewId: z.string().uuid(),
  ticketIds: z.array(z.guid()),
  policyVersion: z.string(),
  fee: z.number().nonnegative(),
  refundAmount: z.number().nonnegative(),
  currency: z.literal("VND"),
  expiresAt: z.string(),
});
const acceptedSchema = z.object({
  operationId: z.string(),
  status: z.string(),
});
const money = (n: number): string =>
  `${new Intl.NumberFormat("vi-VN").format(n)}đ`;
const time = (date: string): string =>
  new Date(date).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });

export function LiveCancellationPage(): ReactElement {
  const { bookingCode = "" } = useParams();
  const valid = z.guid().safeParse(bookingCode).success;
  const session = readApiSession();
  const client = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const query = useQuery({
    queryKey: liveQueryKey("cancellation-page", bookingCode),
    enabled: !!session && valid,
    queryFn: async ({ signal }) => {
      const booking = await apiJson(
        `/api/v1/bookings/${bookingCode}`,
        bookingSchema,
        { signal },
      );
      const tickets: z.infer<typeof backendTicketSchema>[] = [];
      for (let page = 0; ; page++) {
        const result = await apiJson(
          `/api/v1/tickets?page=${page}&size=100`,
          pageOf(backendTicketSchema),
          { signal },
        );
        tickets.push(
          ...result.items.filter(
            (t) => t.bookingId === booking.id && t.status === "ISSUED",
          ),
        );
        if (page + 1 >= result.totalPages) break;
      }
      const trip = await getBackendTrip(booking.tripId, signal);
      return { booking, tickets, trip };
    },
    retry: false,
  });
  const payments = useQuery({
    queryKey: liveQueryKey("cancellation-payments", bookingCode),
    enabled: !!query.data && query.data.booking.paymentChannel === "PREPAID",
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${bookingCode}/payments`,
        z.array(z.object({ provider: z.string(), status: z.string() })),
        { signal },
      ),
    retry: false,
  });
  const preview = useQuery({
    queryKey: liveQueryKey(
      "cancellation-quote",
      bookingCode,
      query.data?.booking.rowVersion,
      [...selected].sort().join(","),
    ),
    enabled:
      !!session &&
      valid &&
      !!query.data &&
      selected.length > 0 &&
      selected.every((id) => query.data?.tickets.some((t) => t.id === id)) &&
      !open,
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${bookingCode}/cancellation-preview`,
        previewSchema,
        {
          method: "POST",
          body: { ticketIds: selected },
          signal,
          idempotencyKey: crypto.randomUUID(),
        },
      ),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
  });
  const cancel = useMutation({
    mutationFn: () => {
      if (
        !query.data ||
        !preview.data ||
        Date.parse(preview.data.expiresAt) <= Date.now()
      )
        throw new Error(
          "Báo phí đã hết hạn. Vui lòng xem lại phí và tiền hoàn.",
        );
      return apiJson(`/api/v1/bookings/${bookingCode}/cancel`, acceptedSchema, {
        method: "POST",
        body: {
          previewId: preview.data.previewId,
          reason: reason.trim(),
          expectedVersion: query.data.booking.rowVersion,
        },
        idempotencyKey: `cancel-${preview.data.previewId}`,
      });
    },
    onSuccess: () => {
      setOpen(false);
      void client.invalidateQueries({ queryKey: ["live-api"] });
    },
    retry: false,
  });
  useEffect(() => {
    if (!preview.data) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [preview.data]);

  if (!valid)
    return (
      <section className="cancellation-page">
        <h1>Hủy vé</h1>
        <p role="alert">Đường dẫn đơn đặt vé không hợp lệ.</p>
      </section>
    );
  if (!session)
    return (
      <section className="cancellation-page">
        <h1>Hủy vé</h1>
        <p>Đăng nhập tài khoản đã đặt vé để tiếp tục.</p>
        <Link to="/login" state={{ from: `/bookings/${bookingCode}/cancel` }}>
          Đăng nhập
        </Link>
      </section>
    );
  if (query.isPending)
    return (
      <section className="cancellation-page">
        <p role="status">Đang tải vé và hành trình…</p>
      </section>
    );
  if (query.isError)
    return (
      <section className="cancellation-page">
        <h1>Hủy vé</h1>
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      </section>
    );
  if (cancel.isSuccess)
    return (
      <section className="cancellation-page">
        <h1>Yêu cầu hủy đã được tiếp nhận</h1>
        <p role="status">
          Hệ thống đã tiếp nhận yêu cầu hủy các vé đã chọn. Việc hoàn tiền được
          xử lý riêng theo trạng thái thực tế.
        </p>
        <Link to="/account/tickets">Vé của tôi</Link>
      </section>
    );
  const { booking, tickets, trip } = query.data;
  if (!tickets.length || !["PAID", "CONFIRMED"].includes(booking.status))
    return (
      <section className="cancellation-page">
        <h1>Không còn vé có thể hủy</h1>
        <p>Đơn {booking.code} không còn vé ở trạng thái cho phép hủy.</p>
        <Link to="/account/tickets">Vé của tôi</Link>
      </section>
    );
  const chosen = tickets.filter((t) => selected.includes(t.id));
  const remaining = preview.data
    ? Math.max(0, Math.ceil((Date.parse(preview.data.expiresAt) - Math.max(now, preview.dataUpdatedAt)) / 1000))
    : 0;
  const quote = preview.data;
  const amount = quote ? quote.fee + quote.refundAmount : null;
  const feePercent =
    quote && amount ? Math.round((quote.fee / amount) * 100) : null;
  const providerCode = payments.data?.find((p) =>
    ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUND_PENDING"].includes(p.status),
  )?.provider;
  const provider = providerCode?.startsWith("VNPAY") ? "VNPay" : providerCode;
  const journey = {
    operatorName: trip.operatorName,
    tripCode: booking.code,
    departureTime: time(trip.departureAt),
    arrivalTime: time(trip.arrivalAt),
    originCity: trip.origin,
    destinationCity: trip.destination,
    originStop: trip.stops.find((s) => s.pickupAllowed)?.name ?? trip.origin,
    destinationStop:
      [...trip.stops].reverse().find((s) => s.dropoffAllowed)?.name ??
      trip.destination,
    durationLabel:
      `${Math.floor((Date.parse(trip.arrivalAt) - Date.parse(trip.departureAt)) / 3600000)} giờ ${Math.round((Date.parse(trip.arrivalAt) - Date.parse(trip.departureAt)) / 60000) % 60 || ""}`.trim(),
    serviceDateLabel: `${time(trip.departureAt)} ngày ${new Date(trip.departureAt).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}`,
    pickupTitle: "",
    pickupAddress: "",
    checkInLabel: "",
    requestedAtLabel: "—",
    recordedAtLabel: "—",
  };
  const maskedPhone =
    booking.contact.phone.length > 5
      ? booking.contact.phone.slice(0, 2) +
        "•• ••• " +
        booking.contact.phone.slice(-3)
      : booking.contact.phone;
  const policyBlock = (
    <section className="cancellation-page__policy">
      <h2>Chính sách hủy vé</h2>
      <div className="cancellation-page__policy-row">
        <img src={policy} alt="" />
        <div>
          <strong>
            {feePercent === null
              ? "Chính sách theo thời điểm khởi hành"
              : `Phí hủy ${feePercent}% theo chính sách hiện hành`}
          </strong>
          <small>
            {quote
              ? `Phí và tiền hoàn được xác nhận bởi hệ thống`
              : "Phí và số tiền hoàn được hệ thống tính khi bạn xem báo phí."}
          </small>
        </div>
        <details>
          <summary>Xem policy</summary>
          <p>
            Từ 24 giờ: 10%; từ 6 đến dưới 24 giờ: 20%; từ 2 đến dưới 6 giờ: 30%.
            Dưới 2 giờ không hỗ trợ tự hủy. Vé trả sau không có tiền hoàn.
          </p>
        </details>
      </div>
      <div className="cancellation-page__policy-row">
        <img src={quoteIcon} alt="" />
        <div>
          <strong>Kiểm tra số vé và số tiền hoàn trước khi xác nhận</strong>
          <small>
            Chỉ các vé được chọn sẽ bị hủy. Các vé còn lại được giữ nguyên.
          </small>
        </div>
      </div>
    </section>
  );
  const renderSummary = (confirming: boolean): ReactElement => (
    <aside
      className="cancellation-page__summary"
      aria-label="Tóm tắt hoàn tiền"
    >
      <div className="cancellation-page__summary-title">
        <h2>Tóm tắt hoàn tiền</h2>
        {quote && (
          <span role="timer">
            {String(Math.floor(remaining / 60)).padStart(2, "0")}:
            {String(remaining % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <section className="cancellation-page__summary-operator">
        <span className="cancellation-page__icon-well">
          <img src={bus} alt="" />
        </span>
        <div>
          <span>NHÀ XE VẬN HÀNH</span>
          <strong>{trip.operatorName}</strong>
          <small>Đơn đặt vé · {booking.code}</small>
        </div>
      </section>
      <section className="cancellation-page__summary-route">
        <strong>
          {trip.origin} → {trip.destination}
        </strong>
        <small>{journey.serviceDateLabel}</small>
        <span>
          {chosen.length
            ? chosen.map((t) => `${t.seatCode} — ${t.passengerName}`).join(", ")
            : "Chưa chọn vé"}
        </span>
      </section>
      <dl className="cancellation-page__amounts">
        <div>
          <dt>Giá trị {selected.length} vé</dt>
          <dd>{amount === null ? "—" : money(amount)}</dd>
        </div>
        <div>
          <dt>Phí hủy{feePercent !== null ? ` ${feePercent}%` : ""}</dt>
          <dd>{quote ? money(quote.fee) : "—"}</dd>
        </div>
        <div>
          <dt>Bạn sẽ được hoàn</dt>
          <dd>{quote ? money(quote.refundAmount) : "—"}</dd>
        </div>
        <div>
          <dt>Hoàn về {provider ?? "giao dịch ban đầu"}</dt>
          <dd>{quote ? money(quote.refundAmount) : "—"}</dd>
        </div>
      </dl>
      <section className="cancellation-page__payment-method">
        <span>PHƯƠNG THỨC HOÀN TIỀN</span>
        <strong>
          {booking.paymentChannel === "PREPAID"
            ? `Giao dịch ${provider ?? "thanh toán"} ban đầu`
            : "Vé trả sau — không phát sinh hoàn tiền"}
        </strong>
      </section>
      {confirming && (
        <label className="live-cancellation__reason">
          Lý do hủy
          <textarea
            required
            maxLength={500}
            value={reason}
            disabled={cancel.isPending}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      {confirming ? (
        <Button
          disabled={!reason.trim() || remaining === 0}
          isLoading={cancel.isPending}
          onClick={() => {
            if (reason.trim() && remaining > 0) cancel.mutate();
          }}
        >
          Xác nhận hủy vé
        </Button>
      ) : (
        <Button
          id="live-cancel-review"
          disabled={!selected.length || preview.isFetching || preview.isError}
          isLoading={preview.isFetching}
          onClick={() => {
            if (
              preview.data &&
              Date.parse(preview.data.expiresAt) > Date.now()
            ) {
              setNow(Date.now());
              setOpen(true);
            } else void preview.refetch();
          }}
        >
          Xem phí và tiền hoàn
        </Button>
      )}
      <Button
        variant="secondary"
        disabled={cancel.isPending}
        onClick={() => {
          if (confirming) setOpen(false);
          else setSelected([]);
        }}
      >
        Giữ lại vé
      </Button>
      {confirming && remaining === 0 && (
        <p role="alert">
          Báo phí đã hết hạn. Quay lại để cập nhật phí và tiền hoàn.
        </p>
      )}
      {confirming && cancel.isError && <ApiFailure error={cancel.error} />}
      {preview.isError && (
        <ApiFailure
          error={preview.error}
          retry={() => void preview.refetch()}
        />
      )}
      <small className="cancellation-page__summary-footnote">
        Không cần nhà xe phê duyệt khi yêu cầu đủ điều kiện.
      </small>
    </aside>
  );
  return (
    <section className="cancellation-page live-cancellation">
      <Heading />
      <div className="cancellation-page__grid">
        <div className="cancellation-page__review-panel">
          <JourneyCard journey={journey} referenceLabel="Đơn đặt vé" />
          <CancellationSelector
            tickets={tickets.map((t) => ({
              ticketId: t.id,
              seatCode: t.seatCode,
              passenger: { fullName: t.passengerName },
            }))}
            selectedIds={selected}
            maskedPhones={Object.fromEntries(
              tickets.map((t) => [t.id, maskedPhone]),
            )}
            onToggle={(id) => {
              setSelected((ids) =>
                ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
              );

              cancel.reset();
            }}
          />
          {policyBlock}
          <section className="cancellation-page__consent">
            <img src={verified} alt="" />
            <div>
              <strong>Bạn có thể hủy một hoặc nhiều vé trong đặt chỗ.</strong>
              <small>
                Chưa có vé nào bị hủy ở bước này. Bạn sẽ xác nhận ở bước tiếp
                theo.
              </small>
            </div>
          </section>
        </div>
        {renderSummary(false)}
      </div>
      <CancellationConfirmDialog
        open={open}
        onOpenChange={(value) => {
          if (!cancel.isPending) setOpen(value);
        }}
        returnFocusId="live-cancel-review"
      >
        <section className="cancellation-page live-cancellation live-cancellation__confirmation">
          <Heading confirm />
          <div className="cancellation-page__grid">
            <div className="cancellation-page__review-panel">
              <JourneyCard journey={journey} referenceLabel="Đơn đặt vé" />
              <CancellationSelector
                tickets={chosen.map((t) => ({
                  ticketId: t.id,
                  seatCode: t.seatCode,
                  passenger: { fullName: t.passengerName },
                }))}
                selectedIds={selected}
                maskedPhones={Object.fromEntries(
                  chosen.map((t) => [t.id, maskedPhone]),
                )}
                onToggle={() => {}}
                disabled
              />
              {policyBlock}
              <section className="cancellation-page__consent">
                <img src={verified} alt="" />
                <div>
                  <strong>
                    Vé đã chọn và mã QR tương ứng sẽ mất hiệu lực khi xác nhận.
                  </strong>
                  <small>Các vé còn lại được giữ nguyên.</small>
                </div>
              </section>
            </div>
            {renderSummary(true)}
          </div>
        </section>
      </CancellationConfirmDialog>
    </section>
  );
}
