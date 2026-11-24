import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { isMockApi } from "@/shared/api/config";
import {
  listBackendStaffCandidates,
  listUserPage,
  updateBackendStaffStatus,
} from "../../repositories/backendAdminRepository";

import { adminKeys } from "@/features/admin/api/adminQueryKeys";
import type { AdminRepository } from "@/features/admin/repositories/adminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import { createHttpAdminRepository } from "@/features/admin/repositories/httpAdminRepository";
import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";
import type {
  Organization,
  Staff,
  StaffInput,
} from "@/features/admin/types/admin";
import type { PagedResult } from "@/features/admin/types/pagination";
import { useMockSession } from "@/features/auth/hooks/useMockSession";

function useAdminRepository(): AdminRepository | null {
  const { session } = useMockSession();
  const token = session?.role === "admin" ? session.token : undefined;
  return useMemo(
    () => (token ? createHttpAdminRepository({ sessionToken: token }) : null),
    [token],
  );
}

function requireRepository(
  repository: AdminRepository | null,
): AdminRepository {
  if (!repository) throw new AdminRepositoryError("HTTP_ERROR", 401);
  return repository;
}

export function useStaff(
  params: AdminListParams,
): UseQueryResult<PagedResult<Staff>, Error> {
  const repository = useAdminRepository();
  return useQuery({
    queryKey: adminKeys.staff.list(params),
    enabled: Boolean(repository),
    queryFn: ({ signal }) =>
      requireRepository(repository).listStaff(params, signal),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useStaffMember(staffId: string): UseQueryResult<Staff, Error> {
  const repository = useAdminRepository();
  return useQuery({
    queryKey: adminKeys.staff.detail(staffId),
    queryFn: ({ signal }) =>
      requireRepository(repository).getStaff(staffId, signal),
    enabled: Boolean(repository && staffId),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

const ORGANIZATION_PARAMS: AdminListParams = Object.freeze({
  page: 1,
  pageSize: 100,
});

export function useStaffOrganizations(): UseQueryResult<
  PagedResult<Organization>,
  Error
> {
  const repository = useAdminRepository();
  return useQuery({
    queryKey: adminKeys.organizations.list(ORGANIZATION_PARAMS),
    enabled: Boolean(repository),
    queryFn: ({ signal }) =>
      requireRepository(repository).listOrganizations(
        ORGANIZATION_PARAMS,
        signal,
      ),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

interface StaffMutationVariables {
  id?: string;
  input: StaffInput;
  statusOnly?: boolean;
}

export function useSaveStaff(): UseMutationResult<
  Staff,
  Error,
  StaffMutationVariables
> {
  const repository = useAdminRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input, statusOnly }) =>
      id && statusOnly && !isMockApi
        ? updateBackendStaffStatus(id, input.status)
        : id
          ? requireRepository(repository).updateStaff(id, input)
          : requireRepository(repository).createStaff(input),
    onSuccess: async (staff) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.staff.all }),
        queryClient.invalidateQueries({
          queryKey: adminKeys.staff.detail(staff.id),
        }),
      ]);
    },
  });
}

export function useStaffCandidates(
  filters: { organizationId?: string; search?: string; enabled?: boolean } = {},
): UseQueryResult<PagedResult<Staff>, Error> {
  const repository = useAdminRepository();
  const rawSearch = filters.search?.trim() ?? "";
  const [settledSearch, setSettledSearch] = useState("");
  useEffect(() => {
    if (isMockApi || filters.enabled === false || rawSearch.length < 2) return;
    const timer = window.setTimeout(() => setSettledSearch(rawSearch), 300);
    return () => window.clearTimeout(timer);
  }, [filters.enabled, rawSearch]);
  const search = rawSearch === settledSearch ? settledSearch : "";
  return useQuery({
    queryKey: ["admin", "staff", "candidates", filters.organizationId, search],
    enabled:
      Boolean(repository) &&
      (filters.enabled ?? true) &&
      (isMockApi || search.length >= 2),
    queryFn: async ({ signal }) => {
      if (isMockApi)
        return requireRepository(repository).listStaff(
          { page: 1, pageSize: 100 },
          signal,
        );
      const items = await listBackendStaffCandidates(signal, {
        organizationId: filters.organizationId,
        search,
      });
      return {
        items,
        total: items.length,
        page: 1,
        pageSize: Math.max(1, items.length),
      };
    },
    refetchOnWindowFocus: false,
  });
}

export function useOrganizationMemberPage(
  organizationId: string,
  page: number,
  active?: boolean,
  search?: string,
) {
  const repository = useAdminRepository();
  return useQuery({
    queryKey: [
      "admin",
      "staff",
      "organization-members",
      organizationId,
      page,
      active,
      search,
    ],
    enabled: Boolean(repository) && !isMockApi,
    queryFn: ({ signal }) =>
      listUserPage(
        { organizationId, page, pageSize: 20, query: search },
        signal,
        {
          membershipActive: active,
        },
      ),
    refetchOnWindowFocus: false,
  });
}
