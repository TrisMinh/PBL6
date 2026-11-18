import { useState, type ReactElement } from "react";
import { Link, useSearchParams } from "react-router";

import { AdminListState } from "@/features/admin/components/AdminDataTable/AdminListState";
import { MembershipDialog } from "@/features/admin/staff/components/MembershipDialog";
import { PlatformRoleDialog } from "@/features/admin/staff/components/PlatformRoleDialog";
import { StaffPageHeader } from "@/features/admin/staff/components/StaffPageHeader";
import {
  useSaveStaff,
  useStaffMember,
  useStaffOrganizations,
} from "@/features/admin/staff/hooks/useStaffData";
import { isStaffNotFound } from "@/features/admin/staff/lib/staffErrors";
import { staffRoleLabel } from "../lib/staffRoleLabel";
import {
  useMemberships,
  useSaveMembership,
} from "@/features/admin/staff/hooks/useMemberships";
import type {
  Organization,
  Staff,
  Membership,
} from "@/features/admin/types/admin";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { StaffProfileAction } from "../components/StaffProfileAction";
import { isMockApi } from "@/shared/api/config";

import "./StaffPages.css";

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return `${new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)} lúc ${new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)}`;
}

function useDetailDialog(): {
  close: () => void;
  isEditOpen: boolean;
  open: (organizationId?: string) => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (isOpen: boolean, organizationId?: string): void => {
    const next = new URLSearchParams(searchParams);
    if (isOpen) next.set("dialog", "edit");
    else next.delete("dialog");
    if (organizationId) next.set("membershipOrganizationId", organizationId);
    else next.delete("membershipOrganizationId");
    setSearchParams(next);
  };
  return {
    close: () => update(false),
    isEditOpen: searchParams.get("dialog") === "edit",
    open: (organizationId?: string) => update(true, organizationId),
  };
}

function IdentityCard({ staff }: { staff: Staff }): ReactElement {
  return (
    <article className="staff-page__detail-card">
      <h2>Thông tin tài khoản</h2>
      <dl>
        <dt>Họ và tên</dt>
        <dd>{staff.fullName}</dd>
        <dt>Trạng thái</dt>
        <dd>
          {(
            {
              ACTIVE: "Hoạt động",
              LOCKED: "Đã khóa",
              DISABLED: "Vô hiệu hóa",
              PENDING_VERIFICATION: "Chờ xác minh",
            } as Record<string, string>
          )[staff.accountStatus ?? ""] ??
            (staff.status === "active" ? "Hoạt động" : "Đã khóa")}
        </dd>
        <dt>Email</dt>
        <dd>{staff.displayEmail ?? staff.email}</dd>
        <dt>Số điện thoại</dt>
        <dd>{staff.displayPhone ?? staff.phone}</dd>
        <dt>Ngày tạo</dt>
        <dd>{formatDate(staff.createdAt)}</dd>
      </dl>
    </article>
  );
}

function StaffCards({
  organization,
  organizations = [],
  staff,
  onEdit,
}: {
  organization?: Organization;
  organizations?: readonly Organization[];
  staff: Staff;
  onEdit: (organizationId?: string) => void;
  isEditOpen: boolean;
}): ReactElement {
  const rows = staff.memberships?.length
    ? staff.memberships
    : [
        {
          organizationId: staff.organizationId,
          role: staff.role,
          memberSince: staff.memberSince,
        },
      ];
  return (
    <section
      className="staff-page__detail-grid"
      aria-label="Thông tin chi tiết nhân viên"
    >
      <IdentityCard staff={staff} />
      <article className="staff-page__detail-card">
        <h2>Vai trò và tổ chức</h2>
        <table className="staff-page__membership-table">
          <thead>
            <tr>
              <th>Tổ chức</th>
              <th>Vai trò</th>
              <th>
                {staff.role === "PLATFORM_SUPPORT"
                  ? "Được cấp từ"
                  : "Thành viên từ"}
              </th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.organizationId || index}>
                <td>
                  <span className="staff-page__mobile-label" aria-hidden="true">
                    Tổ chức
                  </span>
                  {row.role === "PLATFORM_SUPPORT"
                    ? "Nền tảng BLUE"
                    : (organizations.find(
                        (org) => org.id === row.organizationId,
                      )?.name ??
                      organization?.name ??
                      "Chưa xác định nhà xe")}
                </td>
                <td>
                  <span className="staff-page__mobile-label" aria-hidden="true">
                    Vai trò
                  </span>
                  {staffRoleLabel(row.role)}
                </td>
                <td>
                  <span className="staff-page__mobile-label" aria-hidden="true">
                    {staff.role === "PLATFORM_SUPPORT"
                      ? "Được cấp từ"
                      : "Thành viên từ"}
                  </span>
                  {row.memberSince
                    ? row.memberSince.split("-").reverse().join("/")
                    : "—"}
                </td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onEdit(row.organizationId)}
                  >
                    {row.role === "PLATFORM_SUPPORT"
                      ? "Thay đổi vai trò"
                      : "Chỉnh sửa thông tin"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="staff-page__membership-actions">
          {staff.organizationId && staff.role !== "PLATFORM_SUPPORT" && (
            <Link
              to={`${ROUTES.adminOrganizations}/${staff.organizationId}?view=members`}
            >
              Xem thành viên
            </Link>
          )}
          <Button type="button" onClick={() => onEdit()}>
            {staff.role === "PLATFORM_SUPPORT"
              ? "Gán vai trò"
              : "Chỉnh sửa thông tin"}
          </Button>
        </div>
        <p className="staff-page__membership-note">
          Quyền được áp dụng trong phạm vi tổ chức đã gán.
        </p>
      </article>
    </section>
  );
}

function DetailFailure({
  result,
}: {
  result: ReturnType<typeof useStaffMember>;
}): ReactElement {
  return isStaffNotFound(result.error) ? (
    <AdminListState
      description="Nhân viên này không tồn tại hoặc đã bị xóa."
      state="empty"
      title="Không tìm thấy nhân viên"
    />
  ) : (
    <AdminListState
      description="Không thể tải hồ sơ nhân viên."
      onRetry={() => void result.refetch()}
      state="error"
      title="Tải dữ liệu thất bại"
    />
  );
}

function StaffDetailContent({ staff }: { staff: Staff }): ReactElement {
  const organizations = useStaffOrganizations();
  const save = useSaveStaff();
  const memberships = useMemberships({ staffId: staff.id });
  const saveMembership = useSaveMembership();
  const dialog = useDetailDialog();
  const [searchParams] = useSearchParams();
  const [notice, setNotice] = useState("");
  const organization = organizations.data?.items.find(
    (item) => item.id === staff.organizationId,
  );
  const toggleStatus = async (): Promise<void> => {
    try {
      await save.mutateAsync({
        id: staff.id,
        statusOnly: true,
        input: {
          organizationId: staff.organizationId,
          fullName: staff.fullName,
          email: staff.email,
          phone: staff.phone,
          role: staff.role,
          status: staff.status === "active" ? "inactive" : "active",
        },
      });
      setNotice("Đã cập nhật trạng thái tài khoản.");
    } catch {
      setNotice("Không cập nhật được trạng thái tài khoản. Vui lòng thử lại.");
    }
  };
  if (organizations.isPending || memberships.isPending)
    return <AdminListState label="Đang tải tổ chức" state="loading" />;
  if (organizations.isError || memberships.isError)
    return (
      <AdminListState
        title="Tải dữ liệu thất bại"
        description="Không thể tải vai trò và tổ chức."
        state="error"
        onRetry={() => {
          void organizations.refetch();
          void memberships.refetch();
        }}
      />
    );
  const membership = memberships.data?.find(
    (item) =>
      item.organizationId ===
      (searchParams.get("membershipOrganizationId") ?? staff.organizationId),
  );
  const displayStaff = membership
    ? {
        ...staff,
        organizationId: membership.organizationId,
        role: membership.role,
        memberSince: membership.memberSince,
      }
    : staff;
  return (
    <StaffDetailView
      dialog={dialog}
      notice={notice}
      organization={organization}
      organizations={organizations}
      staff={displayStaff}
      toggleStatus={toggleStatus}
      membership={membership}
      saveMembership={saveMembership}
      onMembershipSaved={() => setNotice("Đã cập nhật nhân viên.")}
    />
  );
}

function StaffDetailView({
  dialog,
  notice,
  organization,
  organizations,
  staff,
  toggleStatus,
  membership,
  saveMembership,
  onMembershipSaved,
}: {
  dialog: ReturnType<typeof useDetailDialog>;
  notice: string;
  organization?: Organization;
  organizations: ReturnType<typeof useStaffOrganizations>;
  staff: Staff;
  toggleStatus: () => Promise<void>;
  membership?: Membership;
  saveMembership: ReturnType<typeof useSaveMembership>;
  onMembershipSaved: () => void;
}): ReactElement {
  return (
    <div className="staff-page staff-page--detail">
      <StaffDetailHeader
        staff={staff}
        onToggleStatus={() => void toggleStatus()}
      />
      <StaffCards
        organization={organization}
        organizations={organizations.data?.items ?? []}
        staff={staff}
        onEdit={dialog.open}
        isEditOpen={dialog.isEditOpen}
      />
      {!isMockApi && (
        <StaffProfileAction
          staff={staff}
          organizations={organizations.data?.items ?? []}
        />
      )}
      <p aria-live="polite" className="staff-page__notice" role="status">
        {notice}
      </p>
      <EditStaffDialog
        dialog={dialog}
        organizations={organizations}
        staff={staff}
        membership={membership}
        saveMembership={saveMembership}
        onMembershipSaved={onMembershipSaved}
      />
    </div>
  );
}

function StaffDetailHeader({
  staff,
  onToggleStatus,
}: {
  staff: Staff;
  onToggleStatus: () => void;
}): ReactElement {
  return (
    <>
      <StaffPageHeader
        description={`Nhân viên / ${staff.fullName}`}
        eyebrow="HỒ SƠ NHÂN VIÊN"
        meta={staff.status === "active" ? "Hoạt động" : "Tạm ngưng"}
        title="Chi tiết nhân viên"
      />
      <div className="staff-page__detail-actions">
        <Link to={ROUTES.adminStaff}>Quay lại danh sách</Link>
        <Button onClick={onToggleStatus} type="button" variant="secondary">
          {staff.status === "active" ? "Khóa tài khoản" : "Mở khóa tài khoản"}
        </Button>
      </div>
    </>
  );
}

function EditStaffDialog({
  dialog,
  organizations,
  staff,
  membership,
  saveMembership,
  onMembershipSaved,
}: {
  dialog: ReturnType<typeof useDetailDialog>;
  organizations: ReturnType<typeof useStaffOrganizations>;
  staff: Staff;
  membership?: Membership;
  saveMembership: ReturnType<typeof useSaveMembership>;
  onMembershipSaved: () => void;
}): ReactElement | null {
  if (!dialog.isEditOpen) return null;
  if (staff.role === "PLATFORM_SUPPORT")
    return (
      <PlatformRoleDialog
        staff={staff}
        onClose={dialog.close}
        onSaved={onMembershipSaved}
      />
    );
  return (
    <MembershipDialog
      errorMessage={
        saveMembership.isError || organizations.isError
          ? "Không thể lưu nhân viên. Vui lòng thử lại."
          : undefined
      }
      isPending={saveMembership.isPending}
      onClose={dialog.close}
      onSubmit={async (input, key) => {
        await saveMembership.mutateAsync({ input, key, editing: true });
        dialog.close();
        onMembershipSaved();
      }}
      organizations={organizations.data?.items ?? []}
      staff={[staff]}
      fixedStaff={staff}
      membership={membership}
    />
  );
}

export function StaffDetailPage({
  staffId,
}: {
  staffId: string;
}): ReactElement {
  const result = useStaffMember(staffId);
  if (result.isPending)
    return (
      <div className="staff-page">
        <h1>Chi tiết nhân viên</h1>
        <AdminListState label="Đang tải chi tiết nhân viên" state="loading" />
      </div>
    );
  if (result.isError) return <DetailFailure result={result} />;
  return <StaffDetailContent staff={result.data} />;
}
