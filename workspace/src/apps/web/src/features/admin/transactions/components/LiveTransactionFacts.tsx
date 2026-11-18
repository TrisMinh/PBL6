import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
} from "../../types/admin";
import {
  transactionCode,
  transactionDate,
  transactionMoney,
} from "../transactionProjection";

type Item = AdminBooking | AdminPayment | AdminRefund;
function links(
  resource: string,
  ids: string[] = [],
  codes: Record<string, string> = {},
): ReactNode {
  return ids.length ? (
    <>
      {ids.map((id) => (
        <div key={id}>
          <Link
            className="transaction-page__related-link"
            to={`/admin/${resource}/${id}`}
          >
            {codes[id] || "Chưa có mã"}
          </Link>
        </div>
      ))}
    </>
  ) : (
    "Không có"
  );
}
export function LiveTransactionFacts({
  item,
}: {
  item: Item;
}): ReactElement | null {
  const info = item.live;
  if (!info) return null;
  const booking = "bookingCode" in item;
  const refund = "paymentId" in item;
  const main: [string, ReactNode][] = [
    [
      booking ? "Mã đơn" : refund ? "Mã hoàn tiền" : "Mã thanh toán",
      transactionCode(item),
    ],
    ["Nhà xe", info.organizationName || info.organizationId || "—"],
    ["Trạng thái", info.label],
    ["Ngày tạo", transactionDate(item.createdAt, true)],
    ["Cập nhật gần nhất", transactionDate(item.updatedAt, true)],
    [
      booking
        ? "Tổng giá trị đơn"
        : refund
          ? "Số tiền hoàn"
          : "Số tiền giao dịch",
      transactionMoney("totalVnd" in item ? item.totalVnd : item.amountVnd),
    ],
  ];
  if (booking)
    main.push(
      ["Khách hàng", item.customerName],
      ["Tuyến", item.routeLabel],
      ["Khởi hành", transactionDate(info.departureAt, true)],
      ["Số hành khách", item.passengerCount],
      ["Ghế", info.seats?.join(", ") || "—"],
      ["Vé", info.ticketState || "—"],
    );
  if (info.provider) main.push(["Cổng thanh toán", info.provider]);
  if (!booking)
    main.push(["Mã giao dịch đối tác", info.partnerCode || "Chưa ghi nhận"]);
  if (refund) main.push(["Lý do hoàn tiền", info.reason || "Chưa ghi nhận"]);
  const related: [string, ReactNode][] = [];
  if (booking)
    related.push([
      "Thanh toán",
      links("payments", info.paymentIds, info.paymentCodes),
    ]);
  else
    related.push([
      "Đơn đặt vé",
      links("bookings", [item.bookingId], {
        [item.bookingId]: info.bookingCode || "",
      }),
    ]);
  if (refund)
    related.push([
      "Thanh toán gốc",
      links("payments", [item.paymentId], {
        [item.paymentId]: info.paymentCode || "",
      }),
    ]);
  else
    related.push([
      "Khoản hoàn",
      links("refunds", info.refundIds, info.refundCodes),
    ]);
  if (info.collectedVnd !== undefined)
    related.push(["Đã thu", transactionMoney(info.collectedVnd)]);
  if (info.refundedVnd !== undefined)
    related.push(["Đã hoàn thành công", transactionMoney(info.refundedVnd)]);
  if (info.cancellationFee !== undefined)
    related.push(["Phí hủy", transactionMoney(info.cancellationFee)]);
  if (info.expectedRefundVnd !== undefined)
    related.push(["Khoản phải hoàn", transactionMoney(info.expectedRefundVnd)]);
  return (
    <section className="transaction-page__detail-grid">
      {[
        ["Thông tin giao dịch", main],
        ["Giao dịch liên quan", related],
      ].map(([title, facts]) => (
        <article className="transaction-page__card" key={String(title)}>
          <h2>{title as string}</h2>
          <dl>
            {(facts as [string, ReactNode][]).map(([label, value]) => (
              <div className="transaction-page__fact" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </section>
  );
}
