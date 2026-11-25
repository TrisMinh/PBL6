import { useState, type ReactElement } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { adminKeys } from "@/features/admin/api/adminQueryKeys";
import type { AdminRefund } from "@/features/admin/types/admin";
import { apiJson } from "@/shared/api/client";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

const confirmation = z.object({ status: z.literal("SUCCEEDED") });
const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
});

export function RefundTransferForm({
  refund,
}: {
  refund: AdminRefund;
}): ReactElement {
  const client = useQueryClient();
  const [reference, setReference] = useState("");
  const result = useMutation({
    mutationFn: () =>
      apiJson(`/api/v1/admin/refunds/${refund.id}/transfer`, confirmation, {
        method: "PUT",
        body: { transferReference: reference, amount: refund.amountVnd },
      }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: adminKeys.refunds.all }),
        client.invalidateQueries({ queryKey: adminKeys.payments.all }),
        client.invalidateQueries({ queryKey: adminKeys.bookings.all }),
      ]);
    },
  });
  return (
    <details>
      <summary>Ghi nhận hoàn tiền</summary>
      <p>
        Đối chiếu người nhận và số tiền {currency.format(refund.amountVnd)} với
        chứng từ. Chỉ ghi nhận khi chuyển khoản đã thành công.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!result.isPending && !result.isSuccess) result.mutate();
        }}
      >
        <Input
          name="transferReference"
          label="Mã giao dịch chuyển khoản"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          required
          minLength={4}
          maxLength={120}
          autoComplete="off"
        />
        <Button
          type="submit"
          isLoading={result.isPending}
          disabled={result.isSuccess}
        >
          Xác nhận đã chuyển tiền
        </Button>
      </form>
      {result.isSuccess && <p role="status">Đã ghi nhận hoàn tiền.</p>}
      {result.error && <ApiFailure error={result.error} />}
    </details>
  );
}
