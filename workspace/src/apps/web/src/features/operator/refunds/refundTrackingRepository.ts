import { apiFetch as fetch } from "@/shared/api/client";
import {
  refundTrackingSchema,
  type RefundTracking,
} from "./refundTracking.schema";
export async function getRefundTracking(
  code: string,
  signal?: AbortSignal,
): Promise<RefundTracking | null> {
  const response = await fetch(
    `/api/v1/operator/refund-requests-preview/${encodeURIComponent(code)}`,
    { signal },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw Error("Không tải được hồ sơ hoàn tiền. Vui lòng thử lại.");
  return refundTrackingSchema.parse(await response.json());
}
