import { useMutation } from "@tanstack/react-query";
import { apiJson } from "@/shared/api/client";
import { ApiError } from "@/shared/api/error";
import { livePaymentSchema } from "../schemas/livePayment.schema";

type PaymentToCheck = { id: string; status: string; provider?: string };

export function useSePayRecheck(refresh: () => Promise<unknown>) {
  const check = useMutation({
    mutationFn: async (payment: PaymentToCheck | undefined) => {
      if (
        payment?.provider === "SEPAY" &&
        ["PENDING", "PROCESSING", "FAILED", "CANCELLED"].includes(
          payment.status,
        )
      ) {
        await apiJson(
          `/api/v1/payments/${payment.id}/reconcile`,
          livePaymentSchema,
          {
            method: "POST",
          },
        );
      }
    },
    onSettled: refresh,
    retry: false,
  });

  return {
    recheck: check.mutateAsync,
    checking: check.isPending,
    notice: check.error
      ? check.error instanceof ApiError && check.error.status === 429
        ? "Vui lòng đợi một lát trước khi kiểm tra lại giao dịch."
        : "Chưa thể đối chiếu với SePay. Vui lòng thử lại sau."
      : undefined,
  };
}
