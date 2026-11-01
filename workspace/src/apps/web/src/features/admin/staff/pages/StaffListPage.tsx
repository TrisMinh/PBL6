import { useState, type ReactElement } from "react";
import { useSearchParams } from "react-router";

import plusIcon from "@/assets/admin/plus.svg";
import {
  AdminDataTable,
  type AdminDataColumn,
} from "@/features/admin/components/AdminDataTable/AdminDataTable";
import { AdminListState } from "@/features/admin/components/AdminDataTable/AdminListState";
import { AdminFilters } from "@/features/admin/components/AdminFilters/AdminFilters";
import { useAdminListParams } from "@/features/admin/hooks/useAdminListParams";
import { MembershipDialog } from "@/features/admin/staff/components/MembershipDialog";
import { StaffPageHeader } from "@/features/admin/staff/components/StaffPageHeader";
import {
  useStaff,
  useStaffOrganizations,
} from "@/features/admin/staff/hooks/useStaffData";
import { useSaveMembership } from "@/features/admin/staff/hooks/useMemberships";
import type {
  Organization,
  Staff,
  MembershipInput,
} from "@/features/admin/types/admin";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";

import "./StaffPages.css";

const STATUS_OPTIONS = [
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Tạm ngưng" },
] as const;

function organizationName(
  organizations: readonly Organization[],
  id: string,
): string {
  return (
    organizations.find((organization) => organization.id === id)?.name ?? id
  );
}

function columns(
  organizations: readonly Organization[],
): readonly AdminDataColumn<Staff>[] {
  return [
    { key: "name", header: "Nhân viên", render: (item) => item.fullName },
    {
      key: "email",
      header: "Email",
      render: (item) => item.displayEmail ?? item.email,
    },
    {
      key: "organization",
      header: "Nhà xe",
      render: (item) => organizationName(organizations, item.organizationId),
    },
    {
      key: "role",
      header: "Vai trò",
      render: (item) =>
        item.role === "OPERATOR_ADMIN"
          ? "Quản trị nhà xe"
          : item.role === "DRIVER"
            ? "Tài xế"
            : item.role === "OPERATOR_SCHEDULER"
              ? "Lập lịch"
              : "—",
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (item) => (
        <span
          className={`staff-page__status staff-page__status--${item.status}`}
        >
          {item.status === "active" ? "Hoạt động" : "Tạm ngưng"}
        </span>
      ),
    },
  ];
}

function useDialogUrl(): {
  isCreateOpen: boolean;
  close: () => void;
  open: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const update = (isOpen: boolean): void => {
    const next = new URLSearchParams(searchParams);
    if (isOpen) next.set("dialog", "create");
    else next.delete("dialog");
    setSearchParams(next);
  };
  return {
    isCreateOpen: searchParams.get("dialog") === "create",
    close: () => update(false),
    open: () => update(true),
  };
}

function StaffRows({
  data,
  organizations,
}: {
  data: ReturnType<typeof useStaff>;
  organizations: readonly Organization[];
}): ReactElement {
  if (data.isPending)
    return (
      <AdminListState label="Đang tải danh sách nhân viên" state="loading" />
    );
  if (data.isError)
    return (
      <AdminListState
        description="Không thể tải danh sách nhân viên."
        onRetry={() => void data.refetch()}
        state="error"
        title="Tải dữ liệu thất bại"
      />
    );
  if (data.data.items.length === 0)
    return (
      <AdminListState
        description="Hãy thay đổi bộ lọc hoặc thêm nhân viên mới."
        state="empty"
        title="Chưa có nhân viên phù hợp"
      />
    );
  return (
    <AdminDataTable
      caption="Danh sách nhân viên"
      columns={columns(organizations)}
      getRowHref={(item) =>
        `${ROUTES.adminStaff}/${encodeURIComponent(item.id)}`
      }
      getRowKey={(item) => item.id}
      items={data.data.items}
      variant="figma"
    />
  );
}

function CreateDialog({
  dialog,
  organizations,
  staff,
  onCreated,
  save,
}: {
  dialog: ReturnType<typeof useDialogUrl>;
  organizations: ReturnType<typeof useStaffOrganizations>;
  staff: ReturnType<typeof useStaff>;
  onCreated: () => void;
  save: ReturnType<typeof useSaveMembership>;
}): ReactElement | null {
  if (!dialog.isCreateOpen) return null;
  const submit = async (input: MembershipInput, key: string): Promise<void> => {
    await save.mutateAsync({ input, key, editing: false });
    dialog.close();
    onCreated();
  };
  return (
    <MembershipDialog
      errorMessage={
        save.isError || organizations.isError
          ? "Không thể lưu nhân viên. Vui lòng thử lại."
          : undefined
      }
      isPending={save.isPending}
      onClose={dialog.close}
      onSubmit={submit}
      organizations={organizations.data?.items ?? []}
      staff={staff.data?.items ?? []}
    />
  );
}

export function StaffListPage(): ReactElement {
  const { params, updateParams } = useAdminListParams();
  const result = useStaff(params);
  const availableStaff = useStaff({ page: 1, pageSize: 100 });
  const organizations = useStaffOrganizations();
  const save = useSaveMembership();
  const dialog = useDialogUrl();
  const [notice, setNotice] = useState("");
  const options =
    organizations.data?.items.map((item) => ({
      value: item.id,
      label: item.name,
    })) ?? [];
  const totalPages = result.data
    ? Math.max(1, Math.ceil(result.data.total / result.data.pageSize))
    : undefined;
  return (
    <StaffListView
      dialog={dialog}
      notice={notice}
      onCreated={() => setNotice("Đã thêm nhân viên.")}
      options={options}
      organizations={organizations}
      params={params}
      result={result}
      availableStaff={availableStaff}
      save={save}
      totalPages={totalPages}
      updateParams={updateParams}
    />
  );
}

interface StaffListViewProps {
  dialog: ReturnType<typeof useDialogUrl>;
  notice: string;
  onCreated: () => void;
  options: readonly { label: string; value: string }[];
  organizations: ReturnType<typeof useStaffOrganizations>;
  params: ReturnType<typeof useAdminListParams>["params"];
  result: ReturnType<typeof useStaff>;
  availableStaff: ReturnType<typeof useStaff>;
  save: ReturnType<typeof useSaveMembership>;
  totalPages?: number;
  updateParams: ReturnType<typeof useAdminListParams>["updateParams"];
}

function StaffListView(props: StaffListViewProps): ReactElement {
  return (
    <div className="staff-page">
      <StaffPageHeader
        description="Quản lý nhân viên thuộc các nhà xe và trạng thái tài khoản."
        eyebrow="QUẢN TRỊ NỀN TẢNG"
        meta={`${props.result.data?.total ?? 0} nhân viên`}
        title="Nhân viên"
      />
      <StaffListPanel
        dialog={props.dialog}
        options={props.options}
        organizations={props.organizations}
        params={props.params}
        result={props.result}
        totalPages={props.totalPages}
        updateParams={props.updateParams}
      />
      <p aria-live="polite" className="staff-page__notice" role="status">
        {props.notice}
      </p>
      <CreateDialog
        dialog={props.dialog}
        onCreated={props.onCreated}
        organizations={props.organizations}
        staff={props.availableStaff}
        save={props.save}
      />
    </div>
  );
}

type StaffListPanelProps = Pick<
  StaffListViewProps,
  | "dialog"
  | "options"
  | "organizations"
  | "params"
  | "result"
  | "totalPages"
  | "updateParams"
>;

function StaffListPanel(props: StaffListPanelProps): ReactElement {
  return (
    <section className="staff-page__panel" aria-labelledby="staff-list-title">
      <div className="staff-page__title-row">
        <h2 id="staff-list-title">Danh sách nhân viên</h2>
        <Button onClick={props.dialog.open} type="button">
          <img src={plusIcon} alt="" width={20} height={20} /> Thêm thành viên
        </Button>
      </div>
      <AdminFilters
        organizationOptions={props.options}
        params={props.params}
        statusOptions={STATUS_OPTIONS}
        totalPages={props.totalPages}
        updateParams={props.updateParams}
        variant="figma"
      />
      <StaffRows
        data={props.result}
        organizations={props.organizations.data?.items ?? []}
      />
      {props.result.data && (
        <p className="staff-page__list-count">
          Hiển thị{" "}
          {props.result.data.total
            ? (props.result.data.page - 1) * props.result.data.pageSize + 1
            : 0}
          –
          {Math.min(
            props.result.data.page * props.result.data.pageSize,
            props.result.data.total,
          )}{" "}
          trong {props.result.data.total} nhân viên nhà xe
        </p>
      )}
    </section>
  );
}
