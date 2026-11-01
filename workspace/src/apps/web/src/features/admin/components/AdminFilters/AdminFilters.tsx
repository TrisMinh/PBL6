import { useEffect, useId, useState, type ReactElement } from "react";

import searchIcon from "@/assets/admin/search.svg";
import type { AdminListParamsPatch } from "@/features/admin/hooks/useAdminListParams";
import {
  ADMIN_LIST_STATUSES,
  type AdminListParams,
} from "@/features/admin/schemas/adminListParams.schema";
import type { AdminListStatus } from "@/features/admin/types/admin";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

import "./AdminFilters.css";

export interface AdminFilterOption<T extends string = string> {
  value: T;
  label: string;
}

export interface AdminFiltersProps {
  params: AdminListParams;
  updateParams: (patch: AdminListParamsPatch) => void;
  organizationOptions?: readonly AdminFilterOption[];
  statusOptions: readonly AdminFilterOption<AdminListStatus>[];
  totalPages?: number;
  variant?: "default" | "figma";
}

interface SelectFieldProps {
  allLabel?: string;
  label: string;
  value: string;
  options: readonly AdminFilterOption[];
  onChange: (value: string) => void;
}

function SelectField({
  allLabel = "Tất cả",
  label,
  onChange,
  options,
  value,
}: SelectFieldProps): ReactElement {
  const id = useId();
  return (
    <div className="admin-filters__field">
      <label className="admin-filters__label" htmlFor={id}>
        {label}
      </label>
      <select
        className="admin-filters__select"
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface PaginationButtonProps {
  label: string;
  text: string;
  disabled: boolean;
  onClick: () => void;
  variant: "ghost" | "secondary";
}

function PaginationButton({
  disabled,
  label,
  onClick,
  text,
  variant,
}: PaginationButtonProps): ReactElement {
  return (
    <Button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      type="button"
      variant={variant}
    >
      {text}
    </Button>
  );
}

function PageStatus({
  currentPage,
  totalPages,
}: Pick<PaginationProps, "currentPage" | "totalPages">): ReactElement {
  return (
    <span aria-live="polite" className="admin-filters__page-status">
      Trang {currentPage} / {totalPages}
    </span>
  );
}

export function AdminPagination({
  currentPage,
  onPageChange,
  totalPages,
}: PaginationProps): ReactElement {
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= totalPages;
  return (
    <nav aria-label="Phân trang" className="admin-filters__pagination">
      <PaginationButton
        disabled={isFirstPage}
        label="Trang đầu"
        onClick={() => onPageChange(1)}
        text="Đầu"
        variant="ghost"
      />
      <PaginationButton
        disabled={isFirstPage}
        label="Trang trước"
        onClick={() => onPageChange(currentPage - 1)}
        text="Trước"
        variant="secondary"
      />
      <PageStatus currentPage={currentPage} totalPages={totalPages} />
      <PaginationButton
        disabled={isLastPage}
        label="Trang tiếp theo"
        onClick={() => onPageChange(currentPage + 1)}
        text="Tiếp theo"
        variant="secondary"
      />
      <PaginationButton
        disabled={isLastPage}
        label="Trang cuối"
        onClick={() => onPageChange(totalPages)}
        text="Cuối"
        variant="ghost"
      />
    </nav>
  );
}

function isAdminListStatus(value: string): value is AdminListStatus {
  return ADMIN_LIST_STATUSES.some((status) => status === value);
}

interface FilterControlsProps {
  organizationOptions?: readonly AdminFilterOption[];
  params: AdminListParams;
  statusOptions: readonly AdminFilterOption<AdminListStatus>[];
  updateParams: (patch: AdminListParamsPatch) => void;
  clearFilters: () => void;
  searchResetKey: number;
  variant: "default" | "figma";
}

interface DebouncedSearchProps {
  query: string;
  updateParams: (patch: AdminListParamsPatch) => void;
  variant: "default" | "figma";
  hasOrganization: boolean;
}

function DebouncedSearch({
  query,
  updateParams,
  variant,
  hasOrganization,
}: DebouncedSearchProps): ReactElement {
  const [draft, setDraft] = useState(query);
  useEffect(() => {
    const normalizedQuery = draft.trim();
    if (normalizedQuery === query) return undefined;
    const timer = window.setTimeout(
      () => updateParams({ query: normalizedQuery || undefined }),
      300,
    );
    return () => window.clearTimeout(timer);
  }, [draft, query, updateParams]);
  return (
    <>
      <Input
        label="Tìm kiếm"
        maxLength={100}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={
          variant === "figma"
            ? hasOrganization
              ? "Tên, email, số điện thoại hoặc ID"
              : "Tên tổ chức hoặc mã tổ chức"
            : "Nhập từ khóa"
        }
        type="search"
        value={draft}
      />
      {variant === "figma" && !hasOrganization && (
        <Button
          className="admin-filters__search-action"
          type="button"
          onClick={() => updateParams({ query: draft.trim() || undefined })}
        >
          <img src={searchIcon} alt="" width={18} height={18} /> Tìm kiếm
        </Button>
      )}
    </>
  );
}

function StatusSelect({
  options,
  params,
  updateParams,
}: {
  options: readonly AdminFilterOption<AdminListStatus>[];
  params: AdminListParams;
  updateParams: (patch: AdminListParamsPatch) => void;
}): ReactElement {
  return (
    <SelectField
      label="Trạng thái"
      onChange={(value) => {
        if (value === "" || isAdminListStatus(value))
          updateParams({ status: value || undefined });
      }}
      options={options}
      value={params.status ?? ""}
    />
  );
}

function FilterControls({
  clearFilters,
  organizationOptions,
  params,
  searchResetKey,
  statusOptions,
  updateParams,
  variant,
}: FilterControlsProps): ReactElement {
  return (
    <div className="admin-filters__controls">
      <DebouncedSearch
        key={`${params.query ?? ""}-${searchResetKey}`}
        query={params.query ?? ""}
        updateParams={updateParams}
        variant={variant}
        hasOrganization={Boolean(organizationOptions)}
      />
      {variant === "figma" && (
        <StatusSelect
          options={statusOptions}
          params={params}
          updateParams={updateParams}
        />
      )}
      {organizationOptions ? (
        <SelectField
          allLabel={variant === "figma" ? "Tất cả nhà xe" : "Tất cả"}
          label={variant === "figma" ? "Nhà xe" : "Tổ chức"}
          onChange={(value) =>
            updateParams({ organizationId: value || undefined })
          }
          options={organizationOptions}
          value={params.organizationId ?? ""}
        />
      ) : null}
      {variant !== "figma" && (
        <StatusSelect
          options={statusOptions}
          params={params}
          updateParams={updateParams}
        />
      )}
      {(variant !== "figma" ||
        params.query ||
        params.status ||
        params.organizationId) && (
        <Button onClick={clearFilters} type="button" variant="ghost">
          Xóa bộ lọc
        </Button>
      )}
    </div>
  );
}

function useBoundedPage(
  page: number,
  totalPages: number | undefined,
  updateParams: (patch: AdminListParamsPatch) => void,
): { currentPage: number; totalPages: number } {
  const boundedTotalPages =
    totalPages !== undefined && Number.isFinite(totalPages)
      ? Math.max(1, Math.floor(totalPages))
      : page;
  const currentPage = Math.min(page, boundedTotalPages);
  useEffect(() => {
    if (totalPages !== undefined && page > boundedTotalPages)
      updateParams({ page: boundedTotalPages });
  }, [boundedTotalPages, page, totalPages, updateParams]);
  return { currentPage, totalPages: boundedTotalPages };
}

export function AdminFilters({
  organizationOptions,
  params,
  statusOptions,
  totalPages,
  updateParams,
  variant = "default",
}: AdminFiltersProps): ReactElement {
  const boundedPage = useBoundedPage(params.page, totalPages, updateParams);
  const [searchResetKey, setSearchResetKey] = useState(0);

  const clearFilters = (): void => {
    setSearchResetKey((current) => current + 1);
    updateParams({
      organizationId: undefined,
      page: 1,
      query: undefined,
      status: undefined,
    });
  };

  return (
    <section
      aria-label="Bộ lọc danh sách"
      className={`admin-filters admin-filters--${variant}`}
    >
      <FilterControls
        clearFilters={clearFilters}
        organizationOptions={organizationOptions}
        params={params}
        searchResetKey={searchResetKey}
        statusOptions={statusOptions}
        updateParams={updateParams}
        variant={variant}
      />
      {(variant !== "figma" || boundedPage.totalPages > 1) && (
        <AdminPagination
          currentPage={boundedPage.currentPage}
          onPageChange={(page) => updateParams({ page })}
          totalPages={boundedPage.totalPages}
        />
      )}
    </section>
  );
}
