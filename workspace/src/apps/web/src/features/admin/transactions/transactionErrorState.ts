import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import type { TransactionStateKind } from "./components/TransactionState";
export function transactionErrorState(
  error: Error | null,
): TransactionStateKind {
  if (error instanceof AdminRepositoryError) {
    if (error.status === 403) return "forbidden";
    if (error.status === 404) return "not-found";
    if (!error.canRetry) return "invalid";
  }
  return "error";
}
