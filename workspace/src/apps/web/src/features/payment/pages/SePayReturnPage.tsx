import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { Link, useSearchParams } from "react-router";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { backendTicketSchema, bookingSchema } from "@/shared/api/contracts";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";
import { ROUTES } from "@/shared/config/routes";
import type { PaymentStatus } from "../types/payment";
import { PaymentAccessNotice } from "../components/PaymentAccessNotice";
import { livePaymentSchema } from "../schemas/livePayment.schema";
import { PaymentResultContent } from "./VnPayReturnPage";

export function SePayReturnPage(): ReactElement {
  const [params] = useSearchParams();
  const bookingId = params.get("bookingId") ?? "";
  const valid = z.uuid().safeParse(bookingId).success;
  const result = useQuery({
    queryKey: liveQueryKey("sepay-return", bookingId),
    enabled: valid,
    retry: false,
    queryFn: async ({ signal }) => {
      const [booking, payments] = await Promise.all([
        apiJson(`/api/v1/bookings/${bookingId}`, bookingSchema, { signal }),
        apiJson(
          `/api/v1/bookings/${bookingId}/payments`,
          z.array(livePaymentSchema),
          { signal },
        ),
      ]);
      const payment = payments.find((item) => item.provider === "SEPAY");
      const captured = payment?.status === "SUCCEEDED";
      const tickets = captured
        ? await apiJson(
            `/api/v1/bookings/${bookingId}/tickets`,
            z.array(backendTicketSchema),
            { signal },
          )
        : [];
      const issued = tickets.filter(
        (ticket) =>
          ticket.status === "ISSUED" || ticket.status === "CHECKED_IN",
      );
      let status: PaymentStatus = "pending";
      if (
        captured &&
        issued.length > 0 &&
        issued.length === booking.items.length
      )
        status = "success";
      else if (payment?.status === "CANCELLED") status = "cancelled";
      else if (
        payment &&
        ["FAILED", "REFUNDED", "PARTIALLY_REFUNDED", "REFUND_PENDING"].includes(
          payment.status,
        )
      )
        status = "failed";
      else if (!captured && booking.status === "EXPIRED") status = "failed";
      return {
        tripId: booking.tripId,
        bookingId: booking.id,
        bookingCode: booking.code,
        sessionId: booking.id,
        amountVnd: payment?.amount ?? booking.total,
        createdAt: payment?.createdAt,
        status,
        tickets:
          status === "success"
            ? issued.map((ticket) => ({
                ticketId: ticket.id,
                ticketCode: ticket.publicCode,
                seatCode: ticket.seatCode,
              }))
            : [],
        live: true,
        canRetry:
          booking.status === "PENDING_PAYMENT" &&
          Date.parse(booking.expiresAt) > Date.now() &&
          !captured,
      };
    },
    refetchInterval: (query) =>
      !query.state.error && query.state.data?.status === "pending"
        ? 3000
        : false,
  });
  if (
    result.error instanceof ApiError &&
    [401, 403, 404].includes(result.error.status)
  )
    return (
      <PaymentAccessNotice
        returnTo={`/payment/sepay/return?bookingId=${bookingId}`}
      />
    );
  return (
    <div className="payment-page payment-page--return">
      {!valid ? (
        <PageState
          title="Không thể xác nhận giao dịch"
          description="Thông tin quay lại chưa hợp lệ."
          action={<Link to={ROUTES.home}>Về trang chủ</Link>}
        />
      ) : result.isError ? (
        <PageState
          title="Chưa thể kiểm tra giao dịch"
          description="Kiểm tra kết nối và thử lại."
          action={
            <Button onClick={() => void result.refetch()}>Kiểm tra lại</Button>
          }
        />
      ) : result.data ? (
        <PaymentResultContent
          result={result.data}
          isFetching={result.isFetching}
          onRecheck={() => void result.refetch()}
        />
      ) : (
        <section>
          <h1>Xác nhận thanh toán</h1>
          <BrandLoading compact title="Đang kiểm tra giao dịch và vé…" />
        </section>
      )}
    </div>
  );
}
