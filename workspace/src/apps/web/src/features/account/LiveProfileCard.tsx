import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { z } from "zod";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { liveApiJson as apiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { ProfileEditor } from "./ProfileEditor";
import "./CustomerPreferencesPage.css";
const profileSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  rowVersion: z.number(),
});
export function LiveProfileCard(): ReactElement | null {
  const { session, isHydrated } = useAccountSession();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: liveQueryKey("profile"),
    queryFn: ({ signal }) =>
      apiJson("/api/v1/users/me", profileSchema, { signal }),
    enabled: isHydrated && Boolean(session),
    retry: false,
  });
  if (!session) return null;
  if (query.isPending) return <p role="status">Đang tải hồ sơ…</p>;
  if (query.isError)
    return (
      <ApiFailure error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <ProfileEditor
      key={session.userId}
      userId={session.userId}
      accountInfo={query.data}
      onSave={async (draft) => {
        const phone = draft.phone.replace(/[\s.-]/g, "");
        const next = await apiJson("/api/v1/users/me", profileSchema, {
          method: "PATCH",
          idempotent: true,
          body: {
            fullName: draft.fullName,
            phone: phone.startsWith("0") ? "+84" + phone.slice(1) : phone,
            expectedVersion: query.data.rowVersion,
          },
        });
        client.setQueryData(liveQueryKey("profile"), next);
      }}
    />
  );
}
