import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import {
  useEffect,
  useRef,
  useState,
  type FormEventHandler,
  type ReactElement,
  type RefObject,
} from "react";
import {
  useForm,
  type FieldErrors,
  type UseFormRegister,
} from "react-hook-form";

import closeIcon from "@/assets/admin/close-organization.svg";
import {
  organizationFormSchema,
  type OrganizationFormValues,
} from "@/features/admin/organizations/schemas/organizationForm.schema";
import type { Organization } from "@/features/admin/types/admin";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

import "./OrganizationDialog.css";

export interface OrganizationDialogProps {
  mode: "create" | "edit";
  organization?: Organization;
  errorMessage?: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (values: OrganizationFormValues) => Promise<void>;
}

function DialogHeader({
  isDisabled,
  title,
}: {
  isDisabled: boolean;
  title: string;
}): ReactElement {
  return (
    <header className="organization-dialog__header">
      <Dialog.Title className="organization-dialog__title">
        {title}
      </Dialog.Title>
      <Dialog.Close asChild>
        <Button
          aria-label="Đóng hộp thoại"
          disabled={isDisabled}
          type="button"
          variant="ghost"
        >
          <img src={closeIcon} alt="" width={24} height={24} />
        </Button>
      </Dialog.Close>
    </header>
  );
}

function ContactFormFields({
  errors,
  register,
}: {
  errors: FieldErrors<OrganizationFormValues>;
  register: UseFormRegister<OrganizationFormValues>;
}): ReactElement {
  return (
    <>
      <Input
        label="Tên pháp lý"
        placeholder="Nhập tên pháp lý"
        error={errors.legalName?.message}
        {...register("legalName")}
      />
      <Input
        label="Tên hiển thị"
        placeholder="Nhập tên hiển thị"
        error={errors.name?.message}
        {...register("name")}
      />
      <Input
        label="Mã số thuế"
        placeholder="Nhập mã số thuế"
        error={errors.taxId?.message}
        {...register("taxId")}
      />
      <Input
        label="Địa chỉ"
        placeholder="Nhập địa chỉ"
        error={errors.address?.message}
        {...register("address")}
      />
      <Input
        label="Email liên hệ"
        placeholder="Nhập email liên hệ"
        error={errors.contactEmail?.message}
        type="email"
        {...register("contactEmail")}
      />
      <Input
        label="Số điện thoại"
        placeholder="Nhập số điện thoại"
        error={errors.contactPhone?.message}
        inputMode="numeric"
        {...register("contactPhone")}
      />
    </>
  );
}

function OrganizationFormFields({
  errors,
  register,
}: {
  errors: FieldErrors<OrganizationFormValues>;
  register: UseFormRegister<OrganizationFormValues>;
}): ReactElement {
  return (
    <>
      <ContactFormFields errors={errors} register={register} />
    </>
  );
}

function DialogActions({
  isDisabled,
  mode,
  onClose,
}: {
  isDisabled: boolean;
  mode: OrganizationDialogProps["mode"];
  onClose: () => void;
}): ReactElement {
  return (
    <footer className="organization-dialog__actions">
      <Button
        disabled={isDisabled}
        onClick={onClose}
        type="button"
        variant="secondary"
      >
        Hủy
      </Button>
      <Button disabled={isDisabled} isLoading={isDisabled} type="submit">
        {mode === "create" ? "Tạo tổ chức" : "Lưu thay đổi"}
      </Button>
    </footer>
  );
}

function defaultValues(organization?: Organization): OrganizationFormValues {
  return organization
    ? {
        name: organization.name,
        contactName: organization.contactName ?? "",
        legalName: organization.legalName ?? "",
        taxId: organization.taxId ?? "",
        address: organization.address ?? "",
        contactEmail: organization.contactEmail,
        contactPhone: organization.contactPhone,
        status: organization.status,
      }
    : {
        name: "",
        contactName: "",
        legalName: "",
        taxId: "",
        address: "",
        contactEmail: "",
        contactPhone: "",
        status: "active",
      };
}

function DialogForm({
  errorMessage,
  errors,
  isDisabled,
  mode,
  onClose,
  onSubmit,
  register,
}: Pick<OrganizationDialogProps, "errorMessage" | "mode" | "onClose"> & {
  errors: FieldErrors<OrganizationFormValues>;
  isDisabled: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  register: UseFormRegister<OrganizationFormValues>;
}): ReactElement {
  return (
    <form className="organization-dialog__form" noValidate onSubmit={onSubmit}>
      <OrganizationFormFields errors={errors} register={register} />
      {errorMessage ? (
        <p className="organization-dialog__error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <DialogActions isDisabled={isDisabled} mode={mode} onClose={onClose} />
    </form>
  );
}

function OrganizationDialogShell({
  errorMessage,
  isDisabled,
  mode,
  onClose,
  onSubmit,
  title,
  errors,
  register,
  returnFocusRef,
}: Pick<OrganizationDialogProps, "errorMessage" | "mode" | "onClose"> & {
  errors: FieldErrors<OrganizationFormValues>;
  isDisabled: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  register: UseFormRegister<OrganizationFormValues>;
  returnFocusRef: RefObject<HTMLElement | null>;
  title: string;
}): ReactElement {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isPointerFocus, setIsPointerFocus] = useState(
    () =>
      typeof document === "undefined" ||
      !document.activeElement?.matches(":focus-visible"),
  );
  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open && !isDisabled) onClose();
      }}
      open
    >
      <Dialog.Portal>
        <Dialog.Overlay className="organization-dialog__overlay" />
        <Dialog.Content
          data-pointer-focus={isPointerFocus}
          onPointerDownCapture={() => setIsPointerFocus(true)}
          onKeyDownCapture={() => setIsPointerFocus(false)}
          ref={contentRef}
          className="organization-dialog__content"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (!returnFocusRef.current) return;
            event.preventDefault();
            returnFocusRef.current.focus();
          }}
        >
          <DialogHeader isDisabled={isDisabled} title={title} />
          <Dialog.Description className="organization-dialog__description">
            Nhập thông tin liên hệ và trạng thái của tổ chức.
          </Dialog.Description>
          <DialogForm
            errorMessage={errorMessage}
            errors={errors}
            isDisabled={isDisabled}
            mode={mode}
            onClose={onClose}
            onSubmit={onSubmit}
            register={register}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function OrganizationDialog({
  errorMessage,
  isPending,
  mode,
  onClose,
  onSubmit,
  organization,
}: OrganizationDialogProps): ReactElement {
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const { formState, handleSubmit, register, reset } =
    useForm<OrganizationFormValues>({
      defaultValues: defaultValues(organization),
      resolver: zodResolver(organizationFormSchema),
    });
  useEffect(() => reset(defaultValues(organization)), [organization, reset]);
  const title = mode === "create" ? "Thêm tổ chức" : "Chỉnh sửa tổ chức";
  const submit = handleSubmit(async (values) => {
    await onSubmit(values);
  });
  const isDisabled = isPending || formState.isSubmitting;
  return (
    <OrganizationDialogShell
      errorMessage={errorMessage}
      errors={formState.errors}
      isDisabled={isDisabled}
      mode={mode}
      onClose={onClose}
      onSubmit={submit}
      register={register}
      returnFocusRef={returnFocusRef}
      title={title}
    />
  );
}
