import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent, type ReactElement } from "react";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { WorkspaceDialogHeading } from "./WorkspaceDialogHeading";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import {
  memberInputSchema,
  memberRoles,
  memberStates,
  organizationSchema,
  readWorkspace,
  saveMember,
  saveOrganization,
  setMemberStatus,
  type MemberInput,
  type WorkspaceMember,
} from "./operatorWorkspace";
import "../schedule/SchedulePage.css";
import "./OperatorWorkspace.css";

function MemberEditor({
  member,
  onSaved,
  close,
}: {
  member?: WorkspaceMember;
  onSaved: () => void;
  close: () => void;
}): ReactElement {
  const [form, setForm] = useState<MemberInput>(
    member ?? { name: "", email: "", phone: "", role: "dispatcher" },
  );
  const [error, setError] = useState("");
  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const parsed = memberInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      saveMember(parsed.data, member?.id);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không lưu được thành viên.",
      );
    }
  };
  return (
    <form
      onSubmit={submit}
      noValidate
      className="operator-workspace-demo__form"
    >
      <Input
        label="Họ và tên"
        required
        autoComplete="name"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
      />
      <Input
        label="Email công việc"
        required
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
      />
      <Input
        label="Số điện thoại"
        required
        type="tel"
        autoComplete="tel"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
      />
      <label>
        Vai trò
        <select
          value={form.role}
          onChange={(e) =>
            setForm({ ...form, role: e.target.value as MemberInput["role"] })
          }
        >
          {Object.entries(memberRoles).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <p className="operator-workspace-demo__muted">
        {member
          ? "Thay đổi chỉ áp dụng cho thành viên trong nhà xe này."
          : "Lời mời được lưu trong bản demo. Không có email thật được gửi."}
      </p>
      {error && (
        <p role="alert" className="operator-workspace-demo__error">
          {error}
        </p>
      )}
      <div className="operator-workspace-demo__actions">
        <Button type="button" variant="secondary" onClick={close}>
          Hủy
        </Button>
        <Button type="submit">{member ? "Lưu thay đổi" : "Gửi lời mời"}</Button>
      </div>
    </form>
  );
}

export function OrganizationPage(): ReactElement {
  const [workspace, setWorkspace] = useState(readWorkspace),
    [organization, setOrganization] = useState(workspace.organization);
  const [search, setSearch] = useState(""),
    [role, setRole] = useState("all"),
    [state, setState] = useState("all");
  const [editor, setEditor] = useState<WorkspaceMember | "new" | null>(null),
    [confirm, setConfirm] = useState<WorkspaceMember | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const members = workspace.members.filter(
    (m) =>
      (role === "all" || m.role === role) &&
      (state === "all" || m.status === state) &&
      `${m.name} ${m.email} ${m.phone}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const saveProfile = (event: FormEvent): void => {
    event.preventDefault();
    setError("");
    const parsed = organizationSchema.safeParse(organization);
    if (!parsed.success) {
      setError(
        "Kiểm tra tên, email, số điện thoại 10 chữ số, địa chỉ và mã số thuế.",
      );
      return;
    }
    try {
      saveOrganization(parsed.data);
      setWorkspace(readWorkspace());
      setNotice("Đã lưu thông tin nhà xe trong bản demo.");
    } catch {
      setError(
        "Không lưu được dữ liệu. Vui lòng cho phép lưu trữ trên trình duyệt.",
      );
    }
  };
  const changeState = (): void => {
    if (!confirm) return;
    try {
      setMemberStatus(
        confirm.id,
        confirm.status === "active" ? "suspended" : "active",
      );
      setWorkspace(readWorkspace());
      setNotice(
        confirm.status === "active"
          ? "Đã tạm ngưng thành viên."
          : "Đã kích hoạt thành viên.",
      );
      setConfirm(null);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Không cập nhật được.",
      );
      setConfirm(null);
    }
  };
  return (
    <div className="operator-schedule operator-workspace-demo">
      <a className="operator-schedule__skip" href="#operator-organization-main">
        Đến nội dung chính
      </a>
      <OperatorSidebar />
      <main className="operator-schedule__main" id="operator-organization-main">
        <header className="operator-schedule__header">
          <div>
            <h1>Tổ chức & thành viên</h1>
            <p className="operator-workspace-demo__muted">
              Quản lý hồ sơ nhà xe và quyền của đội ngũ.
            </p>
          </div>
        </header>
        {notice && (
          <p role="status" className="operator-workspace-demo__notice">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="operator-workspace-demo__error">
            {error}
          </p>
        )}
        <section
          className="operator-workspace-demo__card"
          aria-labelledby="organization-profile"
        >
          <div className="operator-workspace-demo__section-heading">
            <h2 id="organization-profile">Hồ sơ nhà xe</h2>
            <span className="operator-workspace-demo__badge">
              Đang hoạt động
            </span>
          </div>
          <form onSubmit={saveProfile} noValidate>
            <div className="operator-workspace-demo__grid">
              <Input
                label="Tên nhà xe"
                required
                value={organization.name}
                onChange={(e) =>
                  setOrganization({ ...organization, name: e.target.value })
                }
              />
              <Input label="Mã tổ chức" value={organization.code} readOnly />
              <Input
                label="Email liên hệ"
                required
                type="email"
                value={organization.email}
                onChange={(e) =>
                  setOrganization({ ...organization, email: e.target.value })
                }
              />
              <Input
                label="Điện thoại liên hệ"
                required
                type="tel"
                value={organization.phone}
                onChange={(e) =>
                  setOrganization({ ...organization, phone: e.target.value })
                }
              />
              <Input
                label="Mã số thuế"
                required
                inputMode="numeric"
                value={organization.taxCode}
                onChange={(e) =>
                  setOrganization({ ...organization, taxCode: e.target.value })
                }
              />
              <Input
                label="Địa chỉ"
                required
                value={organization.address}
                onChange={(e) =>
                  setOrganization({ ...organization, address: e.target.value })
                }
              />
            </div>
            <label className="operator-workspace-demo__checkbox">
              <input
                type="checkbox"
                checked={organization.allowPayLater}
                onChange={(e) =>
                  setOrganization({
                    ...organization,
                    allowPayLater: e.target.checked,
                  })
                }
              />
              Cho phép thanh toán sau trên các chuyến mới
            </label>
            <div className="operator-workspace-demo__actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOrganization(workspace.organization)}
              >
                Khôi phục
              </Button>
              <Button type="submit">Lưu hồ sơ</Button>
            </div>
          </form>
        </section>
        <section
          className="operator-workspace-demo__card"
          aria-labelledby="organization-team"
        >
          <div className="operator-workspace-demo__section-heading">
            <div>
              <h2 id="organization-team">Thành viên tổ chức</h2>
              <p className="operator-workspace-demo__muted">
                {workspace.members.length} thành viên · luôn giữ ít nhất một
                quản trị viên hoạt động
              </p>
            </div>
            <Button onClick={() => setEditor("new")}>Thêm thành viên</Button>
          </div>
          <div className="operator-workspace-demo__filters">
            <Input
              label="Tìm thành viên"
              placeholder="Họ tên, email, số điện thoại"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <label>
              Vai trò
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="all">Tất cả vai trò</option>
                {Object.entries(memberRoles).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Trạng thái
              <select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                {Object.entries(memberStates).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                setSearch("");
                setRole("all");
                setState("all");
              }}
            >
              Xóa bộ lọc
            </Button>
          </div>
          <p role="status" className="operator-workspace-demo__muted">
            {members.length} kết quả
          </p>
          <div className="operator-workspace-demo__members">
            {members.map((member) => (
              <article key={member.id}>
                <div>
                  <h3>{member.name}</h3>
                  <p>{member.email}</p>
                  <p>{member.phone}</p>
                </div>
                <div>
                  <span className="operator-workspace-demo__badge">
                    {memberRoles[member.role]}
                  </span>
                  <p>{memberStates[member.status]}</p>
                </div>
                <div className="operator-workspace-demo__actions">
                  <Button
                    variant="secondary"
                    aria-label={`Chỉnh sửa ${member.name}`}
                    onClick={() => setEditor(member)}
                  >
                    Chỉnh sửa
                  </Button>
                  <Button
                    variant={member.status === "active" ? "ghost" : "secondary"}
                    aria-label={`${member.status === "active" ? "Tạm ngưng" : "Kích hoạt"} ${member.name}`}
                    onClick={() => setConfirm(member)}
                  >
                    {member.status === "active" ? "Tạm ngưng" : "Kích hoạt"}
                  </Button>
                </div>
              </article>
            ))}
            {members.length === 0 && (
              <div className="operator-workspace-demo__empty">
                <h3>Không tìm thấy thành viên</h3>
                <p>Thử tên hoặc email khác, hoặc xóa bộ lọc.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Dialog.Root
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-schedule__overlay" />
          <Dialog.Content className="operator-schedule__dialog operator-workspace-demo__dialog">
            <WorkspaceDialogHeading>
              {editor === "new" ? "Thêm thành viên" : "Chỉnh sửa thành viên"}
            </WorkspaceDialogHeading>
            <Dialog.Description>
              Phân quyền phù hợp với công việc của thành viên trong BlueLine Co.
            </Dialog.Description>
            {editor !== null && (
              <MemberEditor
                key={editor === "new" ? "new" : editor.id}
                member={editor === "new" ? undefined : editor}
                close={() => setEditor(null)}
                onSaved={() => {
                  setWorkspace(readWorkspace());
                  setNotice(
                    editor === "new"
                      ? "Đã tạo lời mời thành viên trong bản demo."
                      : "Đã lưu thông tin thành viên.",
                  );
                  setEditor(null);
                }}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-schedule__overlay" />
          <Dialog.Content className="operator-schedule__dialog">
            <WorkspaceDialogHeading>
              {confirm?.status === "active"
                ? "Tạm ngưng thành viên?"
                : "Kích hoạt thành viên?"}
            </WorkspaceDialogHeading>
            <Dialog.Description>
              {confirm?.name} · {confirm?.email}. Bạn có thể thay đổi lại trạng
              thái sau này.
            </Dialog.Description>
            <div className="operator-workspace-demo__actions">
              <Dialog.Close asChild>
                <Button variant="secondary">Quay lại</Button>
              </Dialog.Close>
              <Button onClick={changeState}>Xác nhận</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
