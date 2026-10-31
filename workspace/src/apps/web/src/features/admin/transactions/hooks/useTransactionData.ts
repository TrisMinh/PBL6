import { useMemo } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { adminKeys } from "@/features/admin/api/adminQueryKeys";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import type { AdminRepository } from "@/features/admin/repositories/adminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import { createHttpAdminRepository } from "@/features/admin/repositories/httpAdminRepository";
import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
} from "@/features/admin/types/admin";
import type { PagedResult } from "@/features/admin/types/pagination";

function useRepository(): AdminRepository | null {
  const { session } = useMockSession();
  const token = session?.role === "admin" ? session.token : undefined;
  return useMemo(
    () => (token ? createHttpAdminRepository({ sessionToken: token }) : null),
    [token],
  );
}

function requireRepository(value: AdminRepository | null): AdminRepository {
  if (!value) throw new AdminRepositoryError("HTTP_ERROR", 401);
  return value;
}

export function useAdminBookings(
  params: AdminListParams,
): UseQueryResult<PagedResult<AdminBooking>, Error> {
  const repository = useRepository();
  return useQuery({
    queryKey: adminKeys.bookings.list(params),
    queryFn: ({ signal }) =>
      requireRepository(repository).listBookings(params, signal),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useAdminBooking(
  id: string,
): UseQueryResult<AdminBooking, Error> {
  const repository = useRepository();
  return useQuery({
    queryKey: adminKeys.bookings.detail(id),
    queryFn: ({ signal }) =>
      requireRepository(repository).getBooking(id, signal),
    enabled: Boolean(id),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useAdminPayments(
  params: AdminListParams,
): UseQueryResult<PagedResult<AdminPayment>, Error> {
  const repository = useRepository();
  return useQuery({
    queryKey: adminKeys.payments.list(params),
    queryFn: ({ signal }) =>
      requireRepository(repository).listPayments(params, signal),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useAdminPayment(
  id: string,
): UseQueryResult<AdminPayment, Error> {
  const repository = useRepository();
  return useQuery({
    queryKey: adminKeys.payments.detail(id),
    queryFn: ({ signal }) =>
      requireRepository(repository).getPayment(id, signal),
    enabled: Boolean(id),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useAdminRefunds(
  params: AdminListParams,
): UseQueryResult<PagedResult<AdminRefund>, Error> {
  const repository = useRepository();
  return useQuery({
    queryKey: adminKeys.refunds.list(params),
    queryFn: ({ signal }) =>
      requireRepository(repository).listRefunds(params, signal),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useAdminRefund(id: string): UseQueryResult<AdminRefund, Error> {
  const repository = useRepository();
  return useQuery({
    queryKey: adminKeys.refunds.detail(id),
    queryFn: ({ signal }) =>
      requireRepository(repository).getRefund(id, signal),
    enabled: Boolean(id),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
