import type {
  CancellationKeyRecord,
  Refund,
} from "@/features/cancellation/types/cancellation";

export const MAX_CANCELLATIONS = 100;

export interface CancellationState {
  refunds: Map<string, Refund>;
  cancellationKeys: Map<string, CancellationKeyRecord>;
}
