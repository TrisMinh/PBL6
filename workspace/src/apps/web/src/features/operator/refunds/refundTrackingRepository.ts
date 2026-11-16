import { operatorRefundRows } from "./refundsRepository";
import {
  refundTrackingSchema,
  type RefundTracking,
} from "./refundTracking.schema";
export async function getRefundTracking(
  code: string,
  signal?: AbortSignal,
): Promise<RefundTracking | null> {
  const item = (await operatorRefundRows(signal)).find(
    (r) => r.bookingCode === code || r.source.id === code,
  );
  return item ? refundTrackingSchema.parse(item) : null;
}
