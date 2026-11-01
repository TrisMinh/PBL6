import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
} from "@/features/admin/types/admin";
import {
  bookingLabel,
  paymentLabel,
  refundLabel,
  PAYMENT_VIEW_LABELS,
  REFUND_VIEW_LABELS,
  transactionDate,
  transactionMoney,
} from "../transactionProjection";

type Fact = readonly [string, ReactNode];
function related(resource: string, id: string): ReactElement {
  return (
    <Link
      className="transaction-page__related-link"
      to={`/admin/${resource}/${encodeURIComponent(id)}`}
    >
      {id}
    </Link>
  );
}
function FactsCard({
  title,
  facts,
}: {
  title: string;
  facts: readonly Fact[];
}): ReactElement {
  return (
    <article className="transaction-page__card">
      <h2>{title}</h2>
      <dl>
        {facts.map(([label, value]) => (
          <div className="transaction-page__fact" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
export function BookingFacts({
  booking,
}: {
  booking: AdminBooking;
}): ReactElement {
  const a = booking.audit;
  const ticket = a
    ? {
        cancelled: "Đã hủy · Không còn hiệu lực",
        issued: `Đã phát hành · ${a.seats.join(", ")}`,
        "not-issued": "Chưa phát hành",
        refunded: "Đã hoàn tiền · Không còn hiệu lực",
      }[a.ticketState]
    : "Chưa ghi nhận";
  const main: Fact[] = [
    ["Mã đơn", booking.bookingCode],
    ["Khách hàng", booking.customerName],
    ["Nhà xe", a?.organizationName ?? booking.organizationId],
    ["Tuyến", booking.routeLabel],
    ...(a
      ? ([
          ["Khởi hành", transactionDate(a.departureAt, true)],
          ["Số ghế đặt", `${a.seats.length} ghế · ${a.seats.join(", ")}`],
        ] satisfies Fact[])
      : ([["Số hành khách", booking.passengerCount]] satisfies Fact[])),
    ["Trạng thái đơn", bookingLabel(booking)],
    ["Vé", ticket],
    ["Tổng giá trị đơn", transactionMoney(booking.totalVnd)],
  ];
  const links: Fact[] = a
    ? [
        ["Thanh toán", related("payments", a.paymentId)],
        ["Trạng thái giao dịch", PAYMENT_VIEW_LABELS[a.paymentState]],
        ["Đã thu", transactionMoney(a.collectedVnd)],
        [
          "Khoản hoàn",
          a.refundId ? related("refunds", a.refundId) : "Không có",
        ],
        ["Số tiền yêu cầu hoàn", transactionMoney(a.refundRequestedVnd)],
        ["Đã hoàn thành công", transactionMoney(a.refundedVnd)],
        [
          "Trạng thái hoàn",
          a.refundState ? REFUND_VIEW_LABELS[a.refundState] : "Không phát sinh",
        ],
      ]
    : [];
  return (
    <section
      className="transaction-page__detail-grid"
      aria-label="Thông tin chi tiết đơn đặt vé"
    >
      <FactsCard title="Thông tin đơn và vé" facts={main} />
      <FactsCard title="Giao dịch liên quan" facts={links} />
    </section>
  );
}
export function PaymentFacts({
  payment,
}: {
  payment: AdminPayment;
}): ReactElement {
  const a = payment.audit;
  const outcome =
    payment.status === "success"
      ? "Đã thu thành công"
      : payment.status === "pending"
        ? "Chưa có kết quả cuối"
        : payment.status === "failed"
          ? "Thất bại"
          : "Đã hủy";
  const main: Fact[] = [
    ["Payment ID", payment.id],
    ["Số tiền giao dịch", transactionMoney(payment.amountVnd)],
    ["Trạng thái", paymentLabel(payment)],
    ["Kết quả thu tiền", outcome],
    ["Cổng thanh toán", a?.provider ?? "Chưa ghi nhận"],
    ["Mã giao dịch đối tác", a?.partnerCode ?? "Chưa ghi nhận"],
    ["Khởi tạo", transactionDate(payment.createdAt, true)],
    ...(a
      ? ([
          ["Nguồn yêu cầu", a.requestedBy],
          ["Correlation ID", a.correlationId],
        ] satisfies Fact[])
      : []),
  ];
  const links: Fact[] = [
    ["Đơn đặt vé", related("bookings", payment.bookingId)],
    ...(a
      ? ([
          ["Nhà xe", a.organizationName],
          ["Đã thu", transactionMoney(a.collectedVnd)],
          [
            "Khoản hoàn",
            a.refundId ? related("refunds", a.refundId) : "Không có",
          ],
          ["Đã hoàn thành công", transactionMoney(a.refundedVnd)],
          [
            "Số tiền chưa hoàn",
            transactionMoney(a.collectedVnd - a.refundedVnd),
          ],
          [
            "Kết quả xác nhận",
            {
              verified: "Đã xác minh giao dịch",
              waiting: "Đang chờ đối tác",
              failed: "Đối tác trả thất bại",
            }[a.verification],
          ],
        ] satisfies Fact[])
      : []),
  ];
  return (
    <section className="transaction-page__detail-grid">
      <FactsCard title="Giao dịch thu tiền" facts={main} />
      <FactsCard title="Đơn và khoản hoàn liên quan" facts={links} />
    </section>
  );
}
export function RefundFacts({ refund }: { refund: AdminRefund }): ReactElement {
  const a = refund.audit;
  const main: Fact[] = [
    ["Refund ID", refund.id],
    ["Số tiền hoàn", transactionMoney(refund.amountVnd)],
    ["Trạng thái", refundLabel(refund)],
    ...(a
      ? ([
          [
            "Lý do",
            a.reason === "operator-cancellation"
              ? "Nhà xe hủy chuyến"
              : "Khách hủy vé",
          ],
          ["Nguồn yêu cầu", a.requestedVia],
        ] satisfies Fact[])
      : []),
    ["Yêu cầu lúc", transactionDate(refund.createdAt, true)],
    ...(a
      ? ([
          [
            "Kết quả xử lý",
            {
              processing: "Đã gửi đối tác · Chờ kết quả",
              completed: "Đối tác xác nhận hoàn thành",
              failed: "Đối tác trả thất bại",
              queued: "Đã ghi nhận yêu cầu",
            }[a.transferState],
          ],
          ["Correlation ID", a.correlationId],
        ] satisfies Fact[])
      : []),
  ];
  const links: Fact[] = [
    ["Thanh toán gốc", related("payments", refund.paymentId)],
    ["Đơn đặt vé", related("bookings", refund.bookingId)],
    ...(a
      ? ([
          ["Đã thu", transactionMoney(a.collectedVnd)],
          ["Giá trị vé bị hủy", transactionMoney(a.cancelledTicketVnd)],
          ["Phí hủy", transactionMoney(a.cancellationFeeVnd)],
          ["Khoản phải hoàn", transactionMoney(a.expectedRefundVnd)],
          ["Đã hoàn thành công", transactionMoney(a.refundedVnd)],
          ["Hiệu lực vé", "Đã hủy · Không khôi phục khi hoàn lỗi"],
        ] satisfies Fact[])
      : []),
  ];
  return (
    <section className="transaction-page__detail-grid">
      <FactsCard title="Khoản hoàn và tiến độ" facts={main} />
      <FactsCard title="Nguồn tiền và căn cứ hoàn" facts={links} />
    </section>
  );
}
