import * as Dialog from "@radix-ui/react-dialog";
import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type ReactElement,
} from "react";
import { UploadSimple } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { useQueryClient } from "@tanstack/react-query";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { WorkspaceDialogHeading } from "./WorkspaceDialogHeading";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";
import { Bus } from "@phosphor-icons/react/dist/csr/Bus";
import { ShieldCheck } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { Headset } from "@phosphor-icons/react/dist/csr/Headset";
import { SteeringWheel } from "@phosphor-icons/react/dist/csr/SteeringWheel";
import { Calculator } from "@phosphor-icons/react/dist/csr/Calculator";
import { ArrowsLeftRight } from "@phosphor-icons/react/dist/csr/ArrowsLeftRight";
import { CheckCircle } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import { PauseCircle } from "@phosphor-icons/react/dist/csr/PauseCircle";
import {
  memberInputSchema,
  memberRoles,
  memberStates,
  organizationSchema,
  readWorkspace,
  emptyWorkspace,
  saveMember,
  saveOrganization,
  setMemberStatus,
  type MemberInput,
  type WorkspaceMember,
} from "./operatorWorkspace";
import "../schedule/SchedulePage.css";
import "./OperatorWorkspace.css";
import "./OrganizationPage.css";

const roleIcons = {
  owner: ShieldCheck,
  dispatcher: ArrowsLeftRight,
  accountant: Calculator,
  support: Headset,
  driver: SteeringWheel,
};
const stateIcons = {
  active: CheckCircle,
  invited: Clock,
  suspended: PauseCircle,
};

const roleDetails = {
  owner: {
    description: "Quản lý hoạt động và đội ngũ của nhà xe.",
    functions: [
      "Cập nhật hồ sơ nhà xe và quản lý thành viên.",
      "Quản lý tuyến, phương tiện và lịch chuyến.",
      "Theo dõi đặt chỗ, thanh toán, đối soát và báo cáo.",
    ],
  },
  dispatcher: {
    description: "Sắp xếp tài nguyên và kế hoạch vận hành chuyến xe.",
    functions: [
      "Quản lý tuyến đường và điểm dừng.",
      "Chuẩn bị lịch chuyến, phương tiện và tài xế.",
      "Theo dõi lịch chạy và phân công vận hành.",
    ],
  },
  accountant: {
    description: "Theo dõi tài chính và đối soát của nhà xe.",
    functions: [
      "Tra cứu giao dịch và trạng thái thanh toán.",
      "Theo dõi hoàn tiền và các khoản đối soát.",
      "Xem báo cáo doanh thu và xuất dữ liệu tài chính.",
    ],
  },
  support: {
    description: "Hỗ trợ hành khách và xử lý nghiệp vụ đặt vé.",
    functions: [
      "Tra cứu đơn đặt chỗ và thông tin hành khách.",
      "Hỗ trợ xử lý yêu cầu hủy vé theo chính sách.",
      "Theo dõi danh sách khách và hỗ trợ kiểm vé.",
    ],
  },
  driver: {
    description: "Thực hiện các chuyến xe được phân công.",
    functions: [
      "Xem lịch chuyến và danh sách khách của chuyến được giao.",
      "Kiểm tra vé, ghi nhận khách lên xe.",
      "Theo dõi thông tin đón và trả khách.",
    ],
  },
} satisfies Record<
  WorkspaceMember["role"],
  { description: string; functions: string[] }
>;

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
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    const parsed = memberInputSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      await saveMember(parsed.data, member?.id);
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
          : "Lời mời được lưu  Không có email thật được gửi."}
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
  const queryClient = useQueryClient();
  const [workspace, setWorkspace] = useState(emptyWorkspace),
    [organization, setOrganization] = useState(workspace.organization);
  const [search, setSearch] = useState(""),
    [role, setRole] = useState("all"),
    [state, setState] = useState("all");
  const [editor, setEditor] = useState<WorkspaceMember | "new" | null>(null),
    [confirm, setConfirm] = useState<WorkspaceMember | null>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [inspectedRole, setInspectedRole] = useState<
    WorkspaceMember["role"] | null
  >(null);
  const [statusError, setStatusError] = useState("");
  const logoInput = useRef<HTMLInputElement>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const InspectedRoleIcon = inspectedRole
    ? roleIcons[inspectedRole]
    : ShieldCheck;
  useEffect(() => {
    let active = true;
    void readWorkspace()
      .then((value) => {
        if (active) {
          setWorkspace(value);
          setOrganization(value.organization);
        }
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Không tải được tổ chức.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const members = workspace.members.filter(
    (m) =>
      (role === "all" || m.role === role) &&
      (state === "all" || m.status === state) &&
      `${m.name} ${m.email} ${m.phone}`
        .toLocaleLowerCase("vi")
        .includes(search.toLocaleLowerCase("vi")),
  );
  const saveProfile = async (event: FormEvent): Promise<void> => {
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
      await saveOrganization(parsed.data);
      void queryClient.invalidateQueries({
        queryKey: liveQueryKey("operator", "organization-brand"),
      });
      setWorkspace(await readWorkspace());
      setNotice("Đã lưu thông tin nhà xe ");
    } catch {
      setError("Không lưu được dữ liệu. Vui lòng thử lại.");
    }
  };
  const changeState = async (): Promise<void> => {
    if (!confirm || changingStatus) return;
    setStatusError("");
    setError("");
    setNotice("");
    setChangingStatus(true);
    try {
      await setMemberStatus(
        confirm.id,
        confirm.status === "active" ? "suspended" : "active",
      );
      setWorkspace(await readWorkspace());
      setNotice(
        confirm.status === "active"
          ? "Đã tạm ngưng thành viên."
          : "Đã kích hoạt thành viên.",
      );
      setConfirm(null);
    } catch (reason) {
      setStatusError(
        reason instanceof Error ? reason.message : "Không cập nhật được.",
      );
    } finally {
      setChangingStatus(false);
    }
  };
  return (
    <div className="operator-schedule operator-workspace-demo operator-organization">
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
            <span className="operator-organization__member-state operator-organization__member-state--active">
              <CheckCircle size={15} weight="fill" /> Đang hoạt động
            </span>
          </div>
          <div className="operator-organization__profile-body">
            <div className="operator-organization__identity">
              <label
                className="operator-organization__avatar"
                title="Đổi logo nhà xe"
              >
                {organization.logoUrl ? (
                  <img src={organization.logoUrl} alt="Logo nhà xe" />
                ) : (
                  <Bus size={56} weight="duotone" />
                )}
                <input
                  ref={logoInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Đổi logo nhà xe"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (
                      !["image/png", "image/jpeg", "image/webp"].includes(
                        file.type,
                      ) ||
                      file.size > 5 * 1024 * 1024
                    ) {
                      setError("Chọn ảnh PNG, JPG hoặc WebP tối đa 5 MB.");
                      return;
                    }
                    try {
                      const bitmap = await createImageBitmap(file);
                      const canvas = document.createElement("canvas");
                      canvas.width = 256;
                      canvas.height = 256;
                      const context = canvas.getContext("2d");
                      if (!context) throw Error("Không thể đọc ảnh");
                      const side = Math.min(bitmap.width, bitmap.height);
                      context.drawImage(
                        bitmap,
                        (bitmap.width - side) / 2,
                        (bitmap.height - side) / 2,
                        side,
                        side,
                        0,
                        0,
                        256,
                        256,
                      );
                      bitmap.close();
                      setOrganization((current) => ({
                        ...current,
                        logoUrl: canvas.toDataURL("image/webp", 0.85),
                      }));
                      setError("");
                    } catch {
                      setError("Không đọc được ảnh. Vui lòng chọn ảnh khác.");
                    }
                  }}
                />
              </label>
              <div>
                <div className="operator-organization__upload-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => logoInput.current?.click()}
                  >
                    <UploadSimple size={16} /> Tải ảnh lên
                  </Button>
                  <span>PNG, JPG, WebP · Tối đa 5 MB</span>
                </div>
              </div>
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
                    setOrganization({
                      ...organization,
                      taxCode: e.target.value,
                    })
                  }
                />
                <Input
                  label="Địa chỉ"
                  required
                  value={organization.address}
                  onChange={(e) =>
                    setOrganization({
                      ...organization,
                      address: e.target.value,
                    })
                  }
                />
              </div>
              <div className="operator-organization__profile-footer">
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
              </div>
            </form>
          </div>
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
          <div
            className="operator-organization__table-scroll"
            tabIndex={0}
            role="region"
            aria-label="Danh sách thành viên"
          >
            <table className="operator-organization__members">
              <thead>
                <tr>
                  <th scope="col">Thành viên</th>
                  <th scope="col">Liên hệ</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const RoleIcon = roleIcons[member.role];
                  const StateIcon = stateIcons[member.status];
                  return (
                    <tr key={member.id}>
                      <th scope="row">{member.name}</th>
                      <td>
                        <p>{member.email}</p>
                        <p>{member.phone}</p>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`operator-organization__role operator-organization__role--${member.role}`}
                          aria-label={`Xem vai trò ${memberRoles[member.role]} của ${member.name}`}
                          aria-haspopup="dialog"
                          onClick={() => setInspectedRole(member.role)}
                        >
                          <RoleIcon size={16} weight="duotone" />
                          {memberRoles[member.role]}
                        </button>
                      </td>
                      <td>
                        <span
                          className={`operator-organization__member-state operator-organization__member-state--${member.status}`}
                        >
                          <StateIcon size={15} weight="fill" />
                          {memberStates[member.status]}
                        </span>
                      </td>
                      <td>
                        <div className="operator-workspace-demo__actions">
                          <Button
                            variant="secondary"
                            aria-label={`Chỉnh sửa ${member.name}`}
                            onClick={() => setEditor(member)}
                          >
                            Chỉnh sửa
                          </Button>
                          <Button
                            variant="secondary"
                            aria-label={`${member.status === "active" ? "Tạm ngưng" : "Kích hoạt"} ${member.name}`}
                            onClick={() => {
                              setStatusError("");
                              setConfirm(member);
                            }}
                          >
                            {member.status === "active"
                              ? "Tạm ngưng"
                              : "Kích hoạt"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="operator-workspace-demo__empty">
                        <h3>Không tìm thấy thành viên</h3>
                        <p>Thử tên hoặc email khác, hoặc xóa bộ lọc.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Dialog.Root
        open={inspectedRole !== null}
        onOpenChange={(open) => {
          if (!open) setInspectedRole(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="operator-schedule__overlay" />
          <Dialog.Content className="operator-schedule__dialog operator-organization__role-dialog">
            <div className="operator-organization__role-symbol">
              <InspectedRoleIcon size={28} weight="duotone" />
            </div>
            <WorkspaceDialogHeading>
              {inspectedRole ? memberRoles[inspectedRole] : "Vai trò"}
            </WorkspaceDialogHeading>
            <Dialog.Description>
              {inspectedRole && roleDetails[inspectedRole].description}
            </Dialog.Description>
            <h3>Chức năng chính</h3>
            <ul>
              {inspectedRole &&
                roleDetails[inspectedRole].functions.map((text) => (
                  <li key={text}>
                    <CheckCircle size={17} weight="fill" />
                    <span>{text}</span>
                  </li>
                ))}
            </ul>
            <p className="operator-organization__role-scope">
              Phạm vi áp dụng trong nhà xe. Thao tác được phép phụ thuộc vào
              phân quyền tài khoản.
            </p>
            <div className="operator-workspace-demo__actions">
              <Dialog.Close asChild>
                <Button>Đã hiểu</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
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
                onSaved={async () => {
                  setWorkspace(await readWorkspace());
                  setNotice(
                    editor === "new"
                      ? "Đã tạo lời mời thành viên "
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
          if (!open && !changingStatus) setConfirm(null);
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
            {statusError && (
              <p role="alert" className="operator-workspace-demo__error">
                {statusError}
              </p>
            )}
            <div className="operator-workspace-demo__actions">
              <Dialog.Close asChild>
                <Button variant="secondary" disabled={changingStatus}>
                  Quay lại
                </Button>
              </Dialog.Close>
              <Button onClick={changeState} isLoading={changingStatus}>
                Xác nhận
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
