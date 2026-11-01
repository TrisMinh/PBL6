import type { ReactElement } from "react";
import bookingIcon from "@/assets/admin/transaction-booking.svg";
import paymentIcon from "@/assets/admin/transaction-payment.svg";
import refundIcon from "@/assets/admin/transaction-refund.svg";
import {
  TRANSACTION_CONFIG,
  type TransactionResource,
} from "../transactionConfig";

export function TransactionIntro({
  resource,
  detail = false,
  subtitle,
}: {
  resource: TransactionResource;
  detail?: boolean;
  subtitle?: string;
}): ReactElement {
  const config = TRANSACTION_CONFIG[resource];
  return (
    <header
      className={`transaction-page__header${detail ? "transaction-page__header--detail" : ""}`}
    >
      <img
        src={
          { bookings: bookingIcon, payments: paymentIcon, refunds: refundIcon }[
            resource
          ]
        }
        alt=""
        width={resource === "bookings" ? 32 : 28}
        height={resource === "bookings" ? 32 : 28}
      />
      <div>
        <h1>{detail ? config.detailTitle : config.title}</h1>
        <p className="transaction-page__description">
          {subtitle ??
            (detail
              ? "Tra cứu hồ sơ giao dịch trong phạm vi được cấp quyền."
              : config.description)}
        </p>
      </div>
    </header>
  );
}
