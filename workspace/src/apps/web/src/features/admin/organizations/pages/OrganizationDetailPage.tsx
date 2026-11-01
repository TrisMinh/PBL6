import { useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router";

import backIcon from "@/assets/admin/back.svg";
import legalIcon from "@/assets/admin/legal.svg";
import contactIcon from "@/assets/admin/contact.svg";
import updatedIcon from "@/assets/admin/updated.svg";
import membersIcon from "@/assets/admin/members.svg";
import membersSectionIcon from "@/assets/admin/members-section.svg";
import plusIcon from "@/assets/admin/plus.svg";
import viewIcon from "@/assets/admin/view.svg";

import { AdminListState } from "@/features/admin/components/AdminDataTable/AdminListState";
import { OrganizationDialog } from "@/features/admin/organizations/components/OrganizationDialog";
import { OrganizationPageHeader } from "@/features/admin/organizations/components/OrganizationPageHeader";
import { MembershipDialog } from "@/features/admin/staff/components/MembershipDialog";
import {
  useStaff,
  useStaffOrganizations,
} from "@/features/admin/staff/hooks/useStaffData";
import {
  useMemberships,
  useSaveMembership,
} from "@/features/admin/staff/hooks/useMemberships";
import {
  useOrganization,
  useSaveOrganization,
} from "@/features/admin/organizations/hooks/useOrganizationData";
import { isOrganizationNotFound } from "@/features/admin/organizations/lib/organizationErrors";
import type {
  Organization,
  OrganizationInput,
} from "@/features/admin/types/admin";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";

import "./OrganizationPages.css";

function formatDate(value: string): string {
  const date = new Date(value);
  return `${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)} lúc ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}`;
}

function DetailCards({
  organization,
}: {
  organization: Organization;
}): ReactElement {
  return (
    <section
      className="organization-page__detail-grid"
      aria-label="Thông tin chi tiết tổ chức"
    >
      <IdentityCard organization={organization} />
      <ContactCard organization={organization} />
      <StatusCard organization={organization} />
    </section>
  );
}

function IdentityCard({
  organization,
}: {
  organization: Organization;
}): ReactElement {
  return (
    <article className="organization-page__detail-card">
      <h2>
        <img src={legalIcon} alt="" width={22} height={22} />
        Thông tin pháp lý
      </h2>
      <dl>
        <dt>Mã tổ chức</dt>
        <dd>{organization.id}</dd>
        <dt>Tên pháp lý</dt>
        <dd>{organization.legalName ?? organization.name}</dd>
        <dt>Mã số thuế</dt>
        <dd>{organization.taxId ?? "—"}</dd>
      </dl>
    </article>
  );
}

function ContactCard({
  organization,
}: {
  organization: Organization;
}): ReactElement {
  return (
    <article className="organization-page__detail-card">
      <h2>
        <img src={contactIcon} alt="" width={22} height={22} />
        Thông tin liên hệ
      </h2>
      <dl>
        <dt>Email liên hệ</dt>
        <dd>{organization.contactEmail}</dd>
        <dt>Số điện thoại</dt>
        <dd>
          {organization.contactPhone.replace(
            /^(\d{3})(\d{4})(\d{4})$/,
            "$1 $2 $3",
          )}
        </dd>
        <dt>Địa chỉ</dt>
        <dd>{organization.address ?? "—"}</dd>
      </dl>
    </article>
  );
}

function StatusCard({
  organization,
}: {
  organization: Organization;
}): ReactElement {
  return (
    <article className="organization-page__detail-card">
      <h2>
        <img src={updatedIcon} alt="" width={22} height={22} />
        Trạng thái và cập nhật
      </h2>
      <dl>
        <dt>Trạng thái</dt>
        <dd>{organization.status === "active" ? "Hoạt động" : "Tạm ngưng"}</dd>
        <dt>Ngày tạo</dt>
        <dd>{formatDate(organization.createdAt)}</dd>
        <dt>Cập nhật gần nhất</dt>
        <dd>{formatDate(organization.updatedAt)}</dd>
      </dl>
    </article>
  );
}

function useDetailDialog(): {
  close: () => void;
  isEditOpen: boolean;
  open: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (isOpen: boolean): void => {
    const next = new URLSearchParams(searchParams);
    if (isOpen) next.set("dialog", "edit");
    else next.delete("dialog");
    setSearchParams(next);
  };
  return {
    close: () => update(false),
    isEditOpen: searchParams.get("dialog") === "edit",
    open: () => update(true),
  };
}

function DetailFailure({
  result,
}: {
  result: ReturnType<typeof useOrganization>;
}): ReactElement {
  return isOrganizationNotFound(result.error) ? (
    <AdminListState
      description="Tổ chức này không tồn tại hoặc đã bị xóa."
      state="empty"
      title="Không tìm thấy tổ chức"
    />
  ) : (
    <AdminListState
      description="Không thể tải hồ sơ tổ chức."
      onRetry={() => void result.refetch()}
      state="error"
      title="Tải dữ liệu thất bại"
    />
  );
}

function DetailHeader({
  organization,
  memberCount,
}: {
  organization: Organization;
  memberCount: number;
}): ReactElement {
  return (
    <>
      <OrganizationPageHeader
        description={organization.legalName ?? organization.contactName ?? ""}
        eyebrow="HỒ SƠ TỔ CHỨC"
        meta={`${organization.id}     /     ${organization.status === "active" ? "Hoạt động" : "Tạm ngưng"}     /     ${memberCount} thành viên`}
        title={organization.name}
      />
      <div className="organization-page__detail-actions">
        <Link to={ROUTES.adminOrganizations}>
          <img src={backIcon} alt="" width={18} height={18} />
          Quay lại danh sách
        </Link>
      </div>
    </>
  );
}

function EditOrganizationDialog({
  dialog,
  organization,
  save,
  submit,
}: {
  dialog: ReturnType<typeof useDetailDialog>;
  organization: Organization;
  save: ReturnType<typeof useSaveOrganization>;
  submit: (input: OrganizationInput) => Promise<void>;
}): ReactElement | null {
  if (!dialog.isEditOpen) return null;
  return (
    <OrganizationDialog
      errorMessage={
        save.isError
          ? "Không thể cập nhật tổ chức. Vui lòng thử lại."
          : undefined
      }
      isPending={save.isPending}
      mode="edit"
      onClose={dialog.close}
      onSubmit={submit}
      organization={organization}
    />
  );
}

function OrganizationDetailContent({
  organization,
}: {
  organization: Organization;
}): ReactElement {
  const save = useSaveOrganization();
  const dialog = useDetailDialog();
  const [notice, setNotice] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const availableStaff = useStaff({ page: 1, pageSize: 100 });
  const organizations = useStaffOrganizations();
  const memberships = useMemberships({ organizationId: organization.id });
  const saveMembership = useSaveMembership();
  const members = (memberships.data ?? []).flatMap((membership) => {
    const staff = availableStaff.data?.items.find(
      (item) => item.id === membership.staffId,
    );
    return staff
      ? [
          {
            ...staff,
            role: membership.role,
            status: membership.status,
            memberSince: membership.memberSince,
          },
        ]
      : [];
  });
  const dialogType = searchParams.get("dialog");
  const isMemberView = searchParams.get("view") === "members";
  const memberStatus =
    searchParams.get("status") === "inactive" ? "inactive" : "active";
  const selectedStaff = members.find(
    (item) => item.id === searchParams.get("staffId"),
  );
  const selectedMembership = memberships.data?.find(
    (item) => item.staffId === selectedStaff?.id,
  );
  const setMemberDialog = (value?: string, staffId?: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("dialog", value);
    else next.delete("dialog");
    if (staffId) next.set("staffId", staffId);
    else next.delete("staffId");
    setSearchParams(next);
  };
  const submit = async (input: OrganizationInput): Promise<void> => {
    await save.mutateAsync({ id: organization.id, input });
    dialog.close();
    setNotice("Đã cập nhật tổ chức.");
  };
  if (
    memberships.isPending ||
    availableStaff.isPending ||
    organizations.isPending
  )
    return <AdminListState label="Đang tải thành viên" state="loading" />;
  if (memberships.isError || availableStaff.isError || organizations.isError)
    return (
      <AdminListState
        title="Tải dữ liệu thất bại"
        description="Không thể tải thành viên tổ chức."
        state="error"
        onRetry={() => {
          void memberships.refetch();
          void availableStaff.refetch();
          void organizations.refetch();
        }}
      />
    );
  return (
    <div
      className={`organization-page organization-page--${isMemberView ? "members" : "detail"}`}
    >
      {isMemberView ? (
        <header className="organization-page__member-header">
          <img src={membersSectionIcon} alt="" width={32} height={32} />
          <div>
            <h1>Thành viên tổ chức</h1>
            <p>
              Quản lý quyền làm việc của nhân viên và tài xế trong từng nhà xe.
            </p>
          </div>
        </header>
      ) : (
        <>
          <DetailHeader
            organization={organization}
            memberCount={members.length}
          />
          <DetailCards organization={organization} />
        </>
      )}
      <section
        className="organization-page__panel"
        aria-label="Thành viên của tổ chức"
      >
        <div className="organization-page__title-row">
          <h2>
            {!isMemberView && (
              <img src={membersIcon} alt="" width={20} height={20} />
            )}
            {isMemberView
              ? `Thành viên ${organization.name}`
              : "Thành viên của tổ chức"}
          </h2>
          {!isMemberView && (
            <Button
              type="button"
              onClick={() => setMemberDialog("create-member")}
            >
              <img src={plusIcon} alt="" width={20} height={20} />
              Thêm thành viên
            </Button>
          )}
        </div>
        {isMemberView && (
          <div className="organization-page__member-filters">
            <div className="organization-page__member-organization">
              <span>Tổ chức</span>
              <strong>{organization.name}</strong>
            </div>
            <label className="organization-page__member-organization">
              Trạng thái
              <select
                aria-label="Trạng thái"
                value={memberStatus}
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("status", event.target.value);
                  setSearchParams(next);
                }}
              >
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
              </select>
            </label>
            <Button
              type="button"
              onClick={() => setMemberDialog("create-member")}
            >
              <img src={plusIcon} alt="" width={20} height={20} />
              Thêm thành viên
            </Button>
          </div>
        )}
        <table className="organization-page__members">
          <thead>
            <tr>
              <th>{isMemberView ? "Thành viên" : "Họ và tên"}</th>
              <th>Vai trò</th>
              <th>Trạng thái</th>
              {isMemberView && <th>Ngày tham gia</th>}
              <th>
                <span className="organization-page__visually-hidden">
                  Hành động
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {members
              .filter(
                (member) => !isMemberView || member.status === memberStatus,
              )
              .map((member) => (
                <tr key={member.id}>
                  <td>
                    <span
                      className="organization-page__mobile-label"
                      aria-hidden="true"
                    >
                      Họ và tên
                    </span>
                    <span className="organization-page__member-identity">
                      {!isMemberView && (
                        <span
                          className="organization-page__avatar"
                          aria-hidden="true"
                        >
                          {member.fullName
                            .split(" ")
                            .slice(-2)
                            .map((part) => part[0])
                            .join("")}
                        </span>
                      )}
                      {member.fullName}
                    </span>
                  </td>
                  <td>
                    <span
                      className="organization-page__mobile-label"
                      aria-hidden="true"
                    >
                      Vai trò
                    </span>
                    <span className="organization-page__role">
                      {member.role === "OPERATOR_ADMIN"
                        ? "Quản trị nhà xe"
                        : member.role === "DRIVER"
                          ? "Tài xế"
                          : "Điều hành chuyến"}
                    </span>
                  </td>
                  <td>
                    <span
                      className="organization-page__mobile-label"
                      aria-hidden="true"
                    >
                      Trạng thái
                    </span>
                    <span className="organization-page__status">
                      {member.status === "active"
                        ? isMemberView
                          ? "Hoạt động"
                          : "Đang hoạt động"
                        : "Tạm ngưng"}
                    </span>
                  </td>
                  {isMemberView && (
                    <td>
                      <span
                        className="organization-page__mobile-label"
                        aria-hidden="true"
                      >
                        Thành viên từ
                      </span>
                      {member.memberSince
                        ? member.memberSince.split("-").reverse().join("/")
                        : "—"}
                    </td>
                  )}
                  <td>
                    <span
                      className="organization-page__mobile-label"
                      aria-hidden="true"
                    >
                      Hành động
                    </span>
                    {!isMemberView && (
                      <Link to={`${ROUTES.adminStaff}/${member.id}`}>
                        <img src={viewIcon} alt="" width={16} height={16} />
                        Xem hồ sơ
                      </Link>
                    )}
                    {isMemberView && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          setMemberDialog("edit-member", member.id)
                        }
                      >
                        Chỉnh sửa
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
      {(dialogType === "create-member" ||
        (dialogType === "edit-member" && selectedStaff)) && (
        <MembershipDialog
          fixedOrganization={organization}
          fixedStaff={selectedStaff}
          membership={selectedMembership}
          organizations={organizations.data?.items ?? [organization]}
          staff={availableStaff.data?.items ?? []}
          isPending={saveMembership.isPending}
          onClose={() => setMemberDialog()}
          onSubmit={async (input, key) => {
            await saveMembership.mutateAsync({
              input,
              key,
              editing: dialogType === "edit-member",
            });
            setMemberDialog();
            setNotice("Đã cập nhật thành viên.");
          }}
          errorMessage={
            saveMembership.isError
              ? "Không thể lưu thành viên. Vui lòng thử lại."
              : undefined
          }
        />
      )}
      <p aria-live="polite" className="organization-page__notice" role="status">
        {notice}
      </p>
      <EditOrganizationDialog
        dialog={dialog}
        organization={organization}
        save={save}
        submit={submit}
      />
    </div>
  );
}

export function OrganizationDetailPage({
  organizationId,
}: {
  organizationId: string;
}): ReactElement {
  const result = useOrganization(organizationId);
  if (result.isPending)
    return (
      <div className="organization-page">
        <h1>Chi tiết tổ chức</h1>
        <AdminListState label="Đang tải chi tiết tổ chức" state="loading" />
      </div>
    );
  if (result.isError) return <DetailFailure result={result} />;
  return <OrganizationDetailContent organization={result.data} />;
}
