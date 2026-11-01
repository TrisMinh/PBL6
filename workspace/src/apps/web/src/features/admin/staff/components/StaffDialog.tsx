import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "@phosphor-icons/react/dist/csr/X";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, type ReactElement } from "react";
import {
  useForm,
  type UseFormRegister,
  type UseFormReturn,
} from "react-hook-form";

import {
  staffFormSchema,
  type StaffFormValues,
} from "@/features/admin/staff/schemas/staffForm.schema";
import type { Organization, Staff } from "@/features/admin/types/admin";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

import "./StaffDialog.css";

export interface StaffDialogProps {
  mode: "create" | "edit";
  staff?: Staff;
  organizations: readonly Organization[];
  isOrganizationLoading: boolean;
  isPending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => Promise<void>;
}

function defaultValues(staff?: Staff): StaffFormValues {
  return staff
    ? {
        organizationId: staff.organizationId,
        fullName: staff.fullName,
        email: staff.email,
        phone: staff.phone,
        status: staff.status,
      }
    : {
        organizationId: "",
        fullName: "",
        email: "",
        phone: "",
        status: "active",
      };
}

function OrganizationField({
  organizationError,
  organizations,
  register,
}: {
  organizationError?: string;
  organizations: readonly Organization[];
  register: UseFormRegister<StaffFormValues>;
}): ReactElement {
  return (
    <div className="staff-dialog__field">
      <label htmlFor="staff-organization">Tổ chức</label>
      <select
        aria-describedby={
          organizationError ? "staff-organization-error" : undefined
        }
        aria-invalid={Boolean(organizationError)}
        id="staff-organization"
        {...register("organizationId")}
      >
        <option value="">Chọn tổ chức</option>
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
      {organizationError ? (
        <p
          className="staff-dialog__error"
          id="staff-organization-error"
          role="alert"
        >
          {organizationError}
        </p>
      ) : null}
    </div>
  );
}

function StatusField({
  register,
}: {
  register: UseFormRegister<StaffFormValues>;
}): ReactElement {
  return (
    <div className="staff-dialog__field">
      <label htmlFor="staff-status">Trạng thái</label>
      <select id="staff-status" {...register("status")}>
        <option value="active">Hoạt động</option>
        <option value="inactive">Tạm ngưng</option>
      </select>
    </div>
  );
}

function StaffTextFields({
  form,
}: {
  form: UseFormReturn<StaffFormValues>;
}): ReactElement {
  return (
    <>
      <Input
        label="Tên nhân viên"
        error={form.formState.errors.fullName?.message}
        {...form.register("fullName")}
      />
      <Input
        label="Email"
        error={form.formState.errors.email?.message}
        type="email"
        {...form.register("email")}
      />
      <Input
        label="Số điện thoại"
        error={form.formState.errors.phone?.message}
        inputMode="numeric"
        {...form.register("phone")}
      />
    </>
  );
}

function StaffFormActions({
  isDisabled,
  onClose,
  submitLabel,
}: {
  isDisabled: boolean;
  onClose: () => void;
  submitLabel: string;
}): ReactElement {
  return (
    <footer className="staff-dialog__actions">
      <Button
        disabled={isDisabled}
        onClick={onClose}
        type="button"
        variant="secondary"
      >
        Hủy
      </Button>
      <Button disabled={isDisabled} isLoading={isDisabled} type="submit">
        {submitLabel}
      </Button>
    </footer>
  );
}

function StaffForm({
  form,
  isDisabled,
  organizations,
  onClose,
  onSubmit,
  submitLabel,
}: {
  form: UseFormReturn<StaffFormValues>;
  isDisabled: boolean;
  organizations: readonly Organization[];
  onClose: () => void;
  onSubmit: (values: StaffFormValues) => Promise<void>;
  submitLabel: string;
}): ReactElement {
  return (
    <form
      className="staff-dialog__form"
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <StaffTextFields form={form} />
      <OrganizationField
        organizationError={form.formState.errors.organizationId?.message}
        organizations={organizations}
        register={form.register}
      />
      <StatusField register={form.register} />
      <StaffFormActions
        isDisabled={isDisabled}
        onClose={onClose}
        submitLabel={submitLabel}
      />
    </form>
  );
}

function StaffDialogHeader({
  isDisabled,
  title,
}: {
  isDisabled: boolean;
  title: string;
}): ReactElement {
  return (
    <header className="staff-dialog__header">
      <Dialog.Title className="staff-dialog__title">{title}</Dialog.Title>
      <Dialog.Close asChild>
        <Button
          aria-label="Đóng hộp thoại"
          disabled={isDisabled}
          type="button"
          variant="ghost"
        >
          <X aria-hidden size={20} />
        </Button>
      </Dialog.Close>
    </header>
  );
}

function StaffDialogBody({
  form,
  isDisabled,
  props,
}: {
  form: UseFormReturn<StaffFormValues>;
  isDisabled: boolean;
  props: StaffDialogProps;
}): ReactElement {
  return (
    <>
      <StaffDialogHeader
        isDisabled={isDisabled}
        title={
          props.mode === "create" ? "Thêm thành viên" : "Chỉnh sửa nhân viên"
        }
      />
      <Dialog.Description className="staff-dialog__description">
        Nhập hồ sơ nhân viên và chọn tổ chức quản lý.
      </Dialog.Description>
      {props.errorMessage ? (
        <p className="staff-dialog__error" role="alert">
          {props.errorMessage}
        </p>
      ) : null}
      <StaffForm
        form={form}
        isDisabled={isDisabled}
        organizations={props.organizations}
        onClose={props.onClose}
        onSubmit={props.onSubmit}
        submitLabel={
          props.mode === "create" ? "Thêm thành viên" : "Lưu thay đổi"
        }
      />
    </>
  );
}

export function StaffDialog(props: StaffDialogProps): ReactElement {
  const form = useForm<StaffFormValues>({
    defaultValues: defaultValues(props.staff),
    resolver: zodResolver(staffFormSchema),
  });
  const { reset } = form;
  useEffect(() => reset(defaultValues(props.staff)), [reset, props.staff]);
  const isDisabled =
    props.isPending ||
    props.isOrganizationLoading ||
    form.formState.isSubmitting;
  return (
    <Dialog.Root onOpenChange={(open) => !open && props.onClose()} open>
      <Dialog.Portal>
        <Dialog.Overlay className="staff-dialog__overlay" />
        <Dialog.Content className="staff-dialog__content">
          <StaffDialogBody form={form} isDisabled={isDisabled} props={props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
