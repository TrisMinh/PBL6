import { useState, type FormEvent, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { LiveRefundCreate } from "@/features/admin/LiveRefundCreate";
import { apiJson } from "@/shared/api/client";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";

const paymentSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  amount: z.number(),
});

export function LiveBookingRefunds({
  bookingId,
}: {
  bookingId: string;
}): ReactElement {
  const query = useQuery({
    queryKey: liveQueryKey("operator-booking-payments", bookingId),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/bookings/${encodeURIComponent(bookingId)}/payments`,
        z.array(paymentSchema),
        { signal },
      ),
    retry: false,
  });
  return (
    <section className="live-api">
      <h2>Giao dịch của đơn</h2>
      {query.isPending ? (
        <p role="status">Đang tải giao dịch…</p>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length === 0 ? (
        <p>Đơn chưa có giao dịch thanh toán trực tuyến.</p>
      ) : (
        query.data.map((payment) => (
          <div key={payment.id}>
            <p>
              {payment.id} · {payment.status} ·{" "}
              {payment.amount.toLocaleString("vi-VN")} VND
            </p>
            <LiveRefundCreate paymentId={payment.id} />
          </div>
        ))
      )}
    </section>
  );
}

export function LiveRefundPaymentLookup(): ReactElement {
  const [input, setInput] = useState("");
  const [paymentId, setPaymentId] = useState("");
  return (
    <section className="live-api">
      <h2>Tạo yêu cầu hoàn tiền</h2>
      <p>Nhập ID giao dịch thanh toán của đơn cần hoàn tiền.</p>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setPaymentId(input.trim());
        }}
      >
        <label>
          ID giao dịch
          <input
            required
            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </label>
        <button type="submit">Tìm giao dịch</button>
      </form>
      {paymentId && <LiveRefundCreate key={paymentId} paymentId={paymentId} />}
    </section>
  );
}
