/** Live administrative API actions. Mock admin pages remain unchanged. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactElement } from "react";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { liveApiJson as apiJson, liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure, ApiTable, type ApiRow } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";

const row = z.record(z.string(), z.unknown());
const rows = z.array(row);
const s = (value: unknown) => typeof value === "string" ? value : "";
const n = (value: unknown) => typeof value === "number" ? value : 0;

export function LiveOrganizationCreate(): ReactElement {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "", contactEmail: "", contactPhone: "", allowPayLater: false });
  const mutation = useMutation({ mutationFn: () => apiJson("/api/v1/admin/organizations", row, {
    method: "POST", idempotent: true, body: { ...form, expectedVersion: 0 },
  }), onSuccess: (value) => {
    void client.invalidateQueries({ queryKey: ["live-api"] });
    void navigate(`/admin/organizations/${encodeURIComponent(s(value.id))}`);
  }, retry: false });
  return <details><summary>Thêm tổ chức</summary>
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); mutation.mutate(); }}>
      <label>Mã tổ chức<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
      <label>Tên tổ chức<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Email liên hệ<input type="email" required value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></label>
      <label>Số điện thoại<input required value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></label>
      <label><input type="checkbox" checked={form.allowPayLater} onChange={(e) => setForm({ ...form, allowPayLater: e.target.checked })} /> Cho phép thanh toán sau</label>
      <Button type="submit" isLoading={mutation.isPending}>Tạo tổ chức</Button>
      {mutation.isError && <ApiFailure error={mutation.error} />}
    </form>
  </details>;
}

export function LiveUserActions({ userId }: { userId: string }): ReactElement {
  const client = useQueryClient();
  const detail = useQuery({ queryKey: liveQueryKey("user-actions", userId), queryFn: ({ signal }) =>
    apiJson(`/api/v1/admin/users/${encodeURIComponent(userId)}`, row, { signal }), enabled: !!userId });
  const user = detail.data;
  const [status, setStatus] = useState("ACTIVE");
  const [roleCodes, setRoleCodes] = useState("");
  const [reason, setReason] = useState("");
  const mutation = useMutation({ mutationFn: (action: "status" | "roles") => apiJson(`/api/v1/admin/users/${encodeURIComponent(userId)}/${action}`, z.unknown(), {
    method: action === "status" ? "PATCH" : "PUT", body: action === "status" ?
      { status, reason, expectedVersion: n(user?.rowVersion) } :
      { roleCodes: roleCodes.split(",").map((r) => r.trim()).filter(Boolean), reason, expectedVersion: n(user?.rowVersion) },
  }), onSuccess: () => { void detail.refetch(); void client.invalidateQueries({ queryKey: ["live-api"] }); }, retry: false });
  return <section className="live-api"><h2>Cập nhật quyền và trạng thái</h2>
    {detail.isPending ? <p>Đang tải…</p> : detail.isError ? <ApiFailure error={detail.error} /> : <>
      <p>Trạng thái hiện tại: {s(user?.status)} · Phiên bản: {n(user?.rowVersion)}</p>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate("status"); }}>
        <label>Trạng thái<select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ACTIVE">ACTIVE</option><option value="DISABLED">DISABLED</option><option value="LOCKED">LOCKED</option>
        </select></label>
        <label>Lý do<input required value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <Button type="submit" isLoading={mutation.isPending}>Lưu trạng thái</Button>
      </form>
      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate("roles"); }}>
        <label>Vai trò mới (mã, ngăn bằng dấu phẩy)
          <input required value={roleCodes} onChange={(e) => setRoleCodes(e.target.value)} placeholder="CUSTOMER, OPERATOR_ADMIN" />
        </label>
        <Button type="submit" disabled={!reason.trim()} isLoading={mutation.isPending}>Thay thế vai trò</Button>
      </form>
      {mutation.isError && <ApiFailure error={mutation.error} />}
    </>}
  </section>;
}

export function LiveOrganizationMembers({ organizationId }: { organizationId: string }): ReactElement {
  const client = useQueryClient();
  const endpoint = `/api/v1/admin/organizations/${encodeURIComponent(organizationId)}/members`;
  const query = useQuery({ queryKey: liveQueryKey("organization-members", organizationId),
    queryFn: ({ signal }) => apiJson(endpoint, rows, { signal }), enabled: !!organizationId });
  const [form, setForm] = useState({ userId: "", roleCodes: "OPERATOR_ADMIN", reason: "", status: "ACTIVE" });
  const mutation = useMutation({ mutationFn: () => apiJson(endpoint, row, { method: "POST", idempotent: true,
    body: { userId: form.userId, roleCodes: form.roleCodes.split(",").map((r) => r.trim()).filter(Boolean),
      status: form.status, reason: form.reason, expectedVersion: 0 },
  }), onSuccess: () => { void query.refetch(); void client.invalidateQueries({ queryKey: ["live-api"] }); }, retry: false });
  return <section className="live-api"><h2>Thành viên tổ chức</h2>
    {query.isPending ? <p>Đang tải…</p> : query.isError ? <ApiFailure error={query.error} /> :
      <ApiTable rows={query.data} columns={[
        { key: "userId", label: "Người dùng", render: (member: ApiRow) => <Link to={`/admin/staff/${encodeURIComponent(s(member.userId))}`}>{s(member.userId)}</Link> },
        { key: "roleCodes", label: "Vai trò" }, { key: "status", label: "Trạng thái" },
        { key: "edit", label: "Quản lý quyền", render: member => <LiveMemberEditor key={`${s(member.id)}:${n(member.rowVersion)}`} organizationId={organizationId} member={member} /> },
      ]} />}
    <details><summary>Thêm thành viên</summary><form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
      <label>Mã người dùng (UUID)<input required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} /></label>
      <label>Vai trò (cách nhau bằng dấu phẩy)<input required value={form.roleCodes} onChange={(e) => setForm({ ...form, roleCodes: e.target.value })} /></label>
      <label>Lý do<input required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></label>
      <Button type="submit" isLoading={mutation.isPending}>Thêm thành viên</Button>
      {mutation.isError && <ApiFailure error={mutation.error} />}
    </form></details>
  </section>;
}

function LiveMemberEditor({ organizationId, member }: { organizationId: string; member: ApiRow }): ReactElement {
  const client = useQueryClient();
  const [roleCodes, setRoleCodes] = useState(Array.isArray(member.roleCodes) ? member.roleCodes.join(", ") : "");
  const [status, setStatus] = useState(s(member.status));
  const [reason, setReason] = useState("");
  const mutation = useMutation({
    mutationFn: () => apiJson(`/api/v1/admin/organizations/${encodeURIComponent(organizationId)}/members/${encodeURIComponent(s(member.id))}`, row, {
      method: "PATCH",
      body: { userId: s(member.userId), roleCodes: roleCodes.split(",").map(value => value.trim()).filter(Boolean),
        status, reason: reason.trim(), expectedVersion: n(member.rowVersion) },
    }),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["live-api"] }); },
    retry: false,
  });
  return <details><summary>Sửa vai trò / ngừng quyền</summary>
    <form onSubmit={event => { event.preventDefault(); mutation.mutate(); }}><fieldset disabled={mutation.isPending}>
      <label>Vai trò trong tổ chức<input value={roleCodes} onChange={event => setRoleCodes(event.target.value)} /></label>
      <label>Quyền truy cập<select value={status} onChange={event => setStatus(event.target.value)}>
        <option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng quyền trong tổ chức</option>
      </select></label>
      <label>Lý do<input required value={reason} onChange={event => setReason(event.target.value)} /></label>
      <Button type="submit" isLoading={mutation.isPending} disabled={!reason.trim()}>Lưu thay đổi quyền</Button>
    </fieldset></form>
    {mutation.isError && <ApiFailure error={mutation.error} />}
  </details>;
}
