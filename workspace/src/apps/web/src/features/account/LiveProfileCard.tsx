import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactElement } from "react";
import { z } from "zod";

import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { liveApiJson as apiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";

const profileSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  rowVersion: z.number(),
});
type Profile = z.infer<typeof profileSchema>;

function ProfileForm({ profile }: { profile: Profile }): ReactElement {
  const client = useQueryClient();
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone);
  const mutation = useMutation({
    mutationFn: () =>
      apiJson("/api/v1/users/me", profileSchema, {
        method: "PATCH",
        idempotent: true,
        body: { fullName, phone, expectedVersion: profile.rowVersion },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["live-api"] }),
    retry: false,
  });
  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <label>
        Email
        <input
          type="email"
          readOnly
          value={profile.email}
          autoComplete="email"
        />
      </label>
      <label>
        Họ tên
        <input
          required
          autoComplete="name"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </label>
      <label>
        Số điện thoại
        <input
          required
          type="tel"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
        />
      </label>
      <Button
        disabled={fullName === profile.fullName && phone === profile.phone}
        isLoading={mutation.isPending}
        type="submit"
      >
        Lưu hồ sơ
      </Button>
      {mutation.isSuccess ? <p role="status">Đã cập nhật hồ sơ.</p> : null}
      {mutation.isError ? <ApiFailure error={mutation.error} /> : null}
      <p className="account-live__profile-footer">
        Thông tin liên hệ giúp nhà xe hỗ trợ bạn trong suốt hành trình.
      </p>
    </form>
  );
}

/** GET and PATCH /api/v1/users/me. Email is shown read-only because changing it needs re-verification. */
export function LiveProfileCard(): ReactElement | null {
  const { session, isHydrated } = useAccountSession();
  const query = useQuery({
    queryKey: liveQueryKey("profile"),
    queryFn: ({ signal }) =>
      apiJson("/api/v1/users/me", profileSchema, { signal }),
    enabled: isHydrated && Boolean(session),
    retry: false,
  });
  if (!session) return null;
  return (
    <section aria-label="Hồ sơ cá nhân" className="account-live__profile">
      <div className="account-live__profile-avatar" aria-hidden="true">
        {query.data?.fullName
          .trim()
          .split(/\s+/)
          .slice(-2)
          .map((part) => part[0])
          .join("")
          .toUpperCase() || "BL"}
      </div>
      <h2>Hồ sơ cá nhân</h2>
      <p className="account-live__profile-caption">
        Quản lý thông tin liên hệ của bạn.
      </p>
      {query.isPending ? <p>Đang tải…</p> : null}
      {query.isError ? <ApiFailure error={query.error} /> : null}
      {query.data ? (
        <ProfileForm key={query.data.rowVersion} profile={query.data} />
      ) : null}
    </section>
  );
}
