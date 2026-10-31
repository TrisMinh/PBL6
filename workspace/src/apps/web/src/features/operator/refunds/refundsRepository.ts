import { apiFetch as fetch } from "@/shared/api/client";
import {
  refundListSchema,
  type RefundFilters,
  type RefundList,
} from "./refunds.schema";
export async function getRefundRequests(
  filters: RefundFilters,
  signal?: AbortSignal,
): Promise<RefundList> {
  const response = await fetch(
    `/api/v1/operator/refund-requests-preview?${new URLSearchParams(filters)}`,
    { signal },
  );
  if (!response.ok)
    throw Error(
      response.status === 400
        ? "Bộ lọc không hợp lệ. Vui lòng kiểm tra ngày và trạng thái."
        : "Không tải được yêu cầu hủy vé. Vui lòng thử lại.",
    );
  return refundListSchema.parse(await response.json());
}
