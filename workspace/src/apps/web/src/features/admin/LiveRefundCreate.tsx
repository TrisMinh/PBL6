import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactElement } from "react";
import { z } from "zod";

import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { liveApiJson as apiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";

const paymentSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  status: z.string(),
  amount: z.number(),
  currency: z.string(),
});
const acceptedSchema = z
  .object({ operationId: z.string().optional() })
  .passthrough();
const REFUNDABLE = ["SUCCEEDED", "PARTIALLY_REFUNDED"];

/** POST /api/v1/refunds. The API checks the role (platform or operator finance) and the payment state. */
export function LiveRefundCreate({
  paymentId,
}: {
  paymentId: string;
}): ReactElement | null {
  const { session, isHydrated } = useAccountSession();
  const client = useQueryClient();
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const payment = useQuery({
    queryKey: liveQueryKey("refund-payment", paymentId),
    queryFn: ({ signal }) =>
      apiJson(
        `/api/v1/payments/${encodeURIComponent(paymentId)}`,
        paymentSchema,
        { signal },
      ),
    enabled: isHydrated && Boolean(session) && Boolean(paymentId),
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: (target: z.infer<typeof paymentSchema>) =>
      apiJson("/api/v1/refunds", acceptedSchema, {
        method: "POST",
        idempotent: true,
        body: {
          refundReference: reference.trim(),
          paymentId: target.id,
          bookingId: target.bookingId,
          amount: Number(amount),
          currency: target.currency,
          reason: reason.trim(),
        },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["live-api"] }),
    retry: false,
  });
  const target = payment.data;
  if (payment.isPending) return <p role="status">Đang tải giao dịch…</p>;
  if (payment.isError)
    return (
      <ApiFailure error={payment.error} retry={() => void payment.refetch()} />
    );
  if (!target || !REFUNDABLE.includes(target.status))
    return <p>Giao dịch chưa ở trạng thái có thể hoàn tiền.</p>;
  return (
    <details>
      <summary>Tạo hoàn tiền</summary>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          mutation.mutate(target);
        }}
      >
        <label>
          Mã hoàn tiền
          <input
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label>
          Số tiền ({target.currency})
          <input
            required
            min={1}
            max={target.amount}
            step={1}
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Lý do
          <input
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <Button isLoading={mutation.isPending} type="submit">
          Tạo hoàn tiền
        </Button>
        {mutation.isSuccess ? (
          <p role="status">Đã gửi yêu cầu hoàn tiền.</p>
        ) : null}
        {mutation.isError ? <ApiFailure error={mutation.error} /> : null}
      </form>
    </details>
  );
}
