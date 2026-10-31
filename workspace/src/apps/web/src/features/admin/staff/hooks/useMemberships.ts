import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from "@tanstack/react-query";
import { useMemo } from "react";

import { createMembershipRepository } from "@/features/admin/repositories/httpAdminRepository";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import type { Membership, MembershipInput } from "@/features/admin/types/admin";
import { useMockSession } from "@/features/auth/hooks/useMockSession";

function useRepository(): ReturnType<typeof createMembershipRepository> | null {
  const { session } = useMockSession();
  const token = session?.role === "admin" ? session.token : undefined;
  return useMemo(
    () => (token ? createMembershipRepository({ sessionToken: token }) : null),
    [token],
  );
}

export function useMemberships(filters: {
  organizationId?: string;
  staffId?: string;
}): UseQueryResult<Membership[], Error> {
  const repository = useRepository();
  return useQuery({
    queryKey: ["admin", "memberships", filters],
    queryFn: ({ signal }) => {
      if (!repository) throw new AdminRepositoryError("HTTP_ERROR", 401);
      return repository.list(filters, signal);
    },
    refetchOnWindowFocus: false,
  });
}

export function useSaveMembership(): UseMutationResult<
  Membership,
  Error,
  { input: MembershipInput; key: string; editing: boolean }
> {
  const repository = useRepository();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      key,
      editing,
    }: {
      input: MembershipInput;
      key: string;
      editing: boolean;
    }) => {
      if (!repository) throw new AdminRepositoryError("HTTP_ERROR", 401);
      return editing ? repository.update(input) : repository.create(input, key);
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["admin", "memberships"] }),
        client.invalidateQueries({ queryKey: ["admin", "staff"] }),
      ]);
    },
  });
}
