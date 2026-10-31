import type {
  CancellationOptions,
  Refund,
} from "@/features/cancellation/types/cancellation";

export type CancellationAccess = Readonly<{
  kind: "guest" | "account";
  token: string;
}>;

export interface CancellationRepository {
  getOptions: (
    bookingCode: string,
    access: CancellationAccess,
    signal?: AbortSignal,
  ) => Promise<CancellationOptions>;
  cancel: (
    bookingCode: string,
    ticketIds: readonly string[],
    idempotencyKey: string,
    access: CancellationAccess,
    signal?: AbortSignal,
  ) => Promise<Refund>;
}
