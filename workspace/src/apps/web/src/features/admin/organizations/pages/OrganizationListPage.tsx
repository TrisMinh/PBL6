import { useState, type ReactElement } from "react";
import { useSearchParams } from "react-router";

import organizationIcon from "@/assets/admin/organization.svg";
import plusIcon from "@/assets/admin/plus.svg";
import {
  AdminDataTable,
  type AdminDataColumn,
} from "@/features/admin/components/AdminDataTable/AdminDataTable";
import { AdminListState } from "@/features/admin/components/AdminDataTable/AdminListState";
import { AdminFilters } from "@/features/admin/components/AdminFilters/AdminFilters";
import { useAdminListParams } from "@/features/admin/hooks/useAdminListParams";
import { OrganizationDialog } from "@/features/admin/organizations/components/OrganizationDialog";
import { OrganizationPageHeader } from "@/features/admin/organizations/components/OrganizationPageHeader";
import {
  useOrganizations,
  useSaveOrganization,
} from "@/features/admin/organizations/hooks/useOrganizationData";
import type {
  Organization,
  OrganizationInput,
} from "@/features/admin/types/admin";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";

import "./OrganizationPages.css";

const STATUS_OPTIONS = [
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Tạm ngưng" },
] as const;

const COLUMNS: readonly AdminDataColumn<Organization>[] = [
  {
    key: "name",
    header: "Tổ chức",
    render: (item) => (
      <span className="organization-page__identity">
        <span className="organization-page__identity-icon">
          <img src={organizationIcon} alt="" width={16} height={16} />
        </span>
        {item.name}
      </span>
    ),
  },
  { key: "id", header: "Mã tổ chức", render: (item) => item.id },
  { key: "contact", header: "Liên hệ", render: (item) => item.contactEmail },
  {
    key: "status",
    header: "Trạng thái",
    render: (item) => (
      <span
        className={`organization-page__status organization-page__status--${item.status}`}
      >
        {item.status === "active" ? "Hoạt động" : "Tạm ngưng"}
      </span>
    ),
  },
];

function useDialogUrl(): {
  isCreateOpen: boolean;
  close: () => void;
  openCreate: () => void;
} {
  const [searchParams, setSearchParams] = useSearchParams();
  const updateDialog = (value?: string): void => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set("dialog", value);
    else next.delete("dialog");
    setSearchParams(next);
  };
  return {
    isCreateOpen: searchParams.get("dialog") === "create",
    close: () => updateDialog(),
    openCreate: () => updateDialog("create"),
  };
}

function ListContent({
  data,
  onRetry,
}: {
  data: ReturnType<typeof useOrganizations>;
  onRetry: () => void;
}): ReactElement {
  if (data.isPending)
    return (
      <AdminListState label="Đang tải danh sách tổ chức" state="loading" />
    );
  if (data.isError)
    return (
      <AdminListState
        description="Không thể tải danh sách tổ chức."
        onRetry={onRetry}
        state="error"
        title="Tải dữ liệu thất bại"
      />
    );
  if (data.data.items.length === 0)
    return (
      <AdminListState
        description="Hãy thay đổi bộ lọc hoặc tạo tổ chức mới."
        state="empty"
        title="Chưa có tổ chức phù hợp"
      />
    );
  return (
    <AdminDataTable
      caption="Danh sách tổ chức"
      columns={COLUMNS}
      getRowHref={(item) =>
        `${ROUTES.adminOrganizations}/${encodeURIComponent(item.id)}`
      }
      getRowKey={(item) => item.id}
      items={data.data.items}
      variant="figma"
    />
  );
}

function CreateOrganizationDialog({
  dialog,
  onCreated,
  save,
}: {
  dialog: ReturnType<typeof useDialogUrl>;
  onCreated: () => void;
  save: ReturnType<typeof useSaveOrganization>;
}): ReactElement | null {
  if (!dialog.isCreateOpen) return null;
  const submit = async (input: OrganizationInput): Promise<void> => {
    await save.mutateAsync({ input });
    dialog.close();
    onCreated();
  };
  return (
    <OrganizationDialog
      errorMessage={
        save.isError ? "Không thể tạo tổ chức. Vui lòng thử lại." : undefined
      }
      isPending={save.isPending}
      mode="create"
      onClose={dialog.close}
      onSubmit={submit}
    />
  );
}

function OrganizationListPanel({
  dialog,
  list,
  params,
  totalPages,
  updateParams,
}: {
  dialog: ReturnType<typeof useDialogUrl>;
  list: ReturnType<typeof useOrganizations>;
  params: ReturnType<typeof useAdminListParams>["params"];
  totalPages?: number;
  updateParams: ReturnType<typeof useAdminListParams>["updateParams"];
}): ReactElement {
  return (
    <section
      className="organization-page__panel"
      aria-labelledby="organization-list-title"
    >
      <div className="organization-page__title-row">
        <h2 id="organization-list-title">Danh sách tổ chức</h2>
        <Button onClick={dialog.openCreate} type="button">
          <img src={plusIcon} alt="" width={20} height={20} /> Thêm tổ chức
        </Button>
      </div>
      <AdminFilters
        params={params}
        statusOptions={STATUS_OPTIONS}
        totalPages={totalPages}
        updateParams={updateParams}
        variant="figma"
      />
      <ListContent data={list} onRetry={() => void list.refetch()} />
      {list.data && (
        <p className="organization-page__list-count">
          Hiển thị{" "}
          {list.data.total ? (list.data.page - 1) * list.data.pageSize + 1 : 0}–
          {Math.min(list.data.page * list.data.pageSize, list.data.total)} trong{" "}
          {list.data.total} tổ chức
        </p>
      )}
    </section>
  );
}

export function OrganizationListPage(): ReactElement {
  const { params, updateParams } = useAdminListParams();
  const result = useOrganizations(params);
  const save = useSaveOrganization();
  const dialog = useDialogUrl();
  const [notice, setNotice] = useState("");
  const totalPages = result.data
    ? Math.max(1, Math.ceil(result.data.total / result.data.pageSize))
    : undefined;
  return (
    <div className="organization-page">
      <OrganizationPageHeader
        description="Quản lý nhà xe và thông tin tổ chức trên nền tảng."
        eyebrow="QUẢN TRỊ NỀN TẢNG"
        meta={`${result.data?.total ?? 0} tổ chức     /     ${result.data?.items.filter((item) => item.status === "active").length ?? 0} đang hoạt động     /     ${result.data?.items.filter((item) => item.status === "inactive").length ?? 0} tạm ngưng`}
        title="Tổ chức"
      />
      <OrganizationListPanel
        dialog={dialog}
        list={result}
        params={params}
        totalPages={totalPages}
        updateParams={updateParams}
      />
      <p aria-live="polite" className="organization-page__notice" role="status">
        {notice}
      </p>
      <CreateOrganizationDialog
        dialog={dialog}
        onCreated={() => setNotice("Đã tạo tổ chức.")}
        save={save}
      />
    </div>
  );
}
