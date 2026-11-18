import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import { ApiError } from "@/shared/api/error";
import type { TransactionStateKind } from "./components/TransactionState";
export function transactionErrorState(
  error: Error | null,
): TransactionStateKind {
  if (error instanceof AdminRepositoryError || error instanceof ApiError) {
    if (error.status === 403) return "forbidden";
    if (error.status === 404) return "not-found";
    if (error instanceof AdminRepositoryError && !error.canRetry)
      return "invalid";
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 429
    )
      return "invalid";
  }
  return "error";
}
