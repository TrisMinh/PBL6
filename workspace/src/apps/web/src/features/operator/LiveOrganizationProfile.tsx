import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactElement } from "react";
import { z } from "zod";

import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { liveApiJson as apiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";

const organizationSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  contactEmail: z.string().nullish(),
  contactPhone: z.string().nullish(),
  allowPayLater: z.boolean().optional(),
  commissionRate: z.number().optional(),
  rowVersion: z.number(),
});
type Organization = z.infer<typeof organizationSchema>;

function OrganizationForm({
  organization,
}: {
  organization: Organization;
}): ReactElement {
  const client = useQueryClient();
  const [allowPayLater, setAllowPayLater] = useState(
    organization.allowPayLater ?? false,
  );
  const [name, setName] = useState(organization.name);
  const [email, setEmail] = useState(organization.contactEmail ?? "");
  const [phone, setPhone] = useState(organization.contactPhone ?? "");
  const mutation = useMutation({
    mutationFn: () =>
      apiJson("/api/v1/operator/organization", organizationSchema, {
        method: "PATCH",
        idempotent: true,
        body: {
          name: name.trim(),
          contactEmail: email.trim(),
          contactPhone: phone.trim(),
          allowPayLater,
          expectedVersion: organization.rowVersion,
        },
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
      <p>Mã tổ chức: {organization.code}</p>
      <label>
        Tên nhà xe
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Email liên hệ
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label>
        Số điện thoại liên hệ
        <input
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={allowPayLater}
          onChange={(e) => setAllowPayLater(e.target.checked)}
        />
        Cho phép thanh toán sau
      </label>
      <Button isLoading={mutation.isPending} type="submit">
        Lưu hồ sơ nhà xe
      </Button>
      {mutation.isSuccess ? (
        <p role="status">Đã cập nhật hồ sơ nhà xe.</p>
      ) : null}
      {mutation.isError ? <ApiFailure error={mutation.error} /> : null}
    </form>
  );
}

/** GET and PATCH /api/v1/operator/organization. Hidden for accounts without an operator organization. */
export function LiveOrganizationProfile(): ReactElement | null {
  const { session, isHydrated } = useAccountSession();
  const query = useQuery({
    queryKey: liveQueryKey("operator-organization"),
    queryFn: ({ signal }) =>
      apiJson("/api/v1/operator/organization", organizationSchema, { signal }),
    enabled: isHydrated && Boolean(session),
    retry: false,
  });
  if (!query.data) return null;
  return (
    <details className="live-api">
      <summary>Hồ sơ nhà xe</summary>
      <OrganizationForm key={query.data.rowVersion} organization={query.data} />
    </details>
  );
}
