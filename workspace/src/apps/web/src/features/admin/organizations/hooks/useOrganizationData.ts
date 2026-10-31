import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useMemo } from "react";

import { adminKeys } from "@/features/admin/api/adminQueryKeys";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { createHttpAdminRepository } from "@/features/admin/repositories/httpAdminRepository";
import type { AdminRepository } from "@/features/admin/repositories/adminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";
import type {
  Organization,
  OrganizationInput,
} from "@/features/admin/types/admin";
import type { PagedResult } from "@/features/admin/types/pagination";

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

export function useOrganizations(
  params: AdminListParams,
): UseQueryResult<PagedResult<Organization>, Error> {
  const repository = useAdminRepository();
  return useQuery({
    queryKey: adminKeys.organizations.list(params),
    queryFn: ({ signal }) =>
      requireRepository(repository).listOrganizations(params, signal),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useOrganization(
  organizationId: string,
): UseQueryResult<Organization, Error> {
  const repository = useAdminRepository();
  return useQuery({
    queryKey: adminKeys.organizations.detail(organizationId),
    queryFn: ({ signal }) =>
      requireRepository(repository).getOrganization(organizationId, signal),
    enabled: Boolean(organizationId),
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}

interface OrganizationMutationVariables {
  id?: string;
  input: OrganizationInput;
}

export function useSaveOrganization(): UseMutationResult<
  Organization,
  Error,
  OrganizationMutationVariables
> {
  const repository = useAdminRepository();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) =>
      id
        ? requireRepository(repository).updateOrganization(id, input)
        : requireRepository(repository).createOrganization(input),
    onSuccess: async (organization) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminKeys.organizations.all,
        }),
        queryClient.invalidateQueries({
          queryKey: adminKeys.organizations.detail(organization.id),
        }),
      ]);
    },
  });
}
