import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";

export function isOrganizationNotFound(error: Error | null): boolean {
  return error instanceof AdminRepositoryError && error.status === 404;
}
