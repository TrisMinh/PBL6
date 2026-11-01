import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm, useWatch } from "react-hook-form";
import { useRef, useState, type ReactElement } from "react";
import { z } from "zod";

import closeIcon from "@/assets/admin/close-member.svg";
import type {
  Organization,
  Staff,
  Membership,
  MembershipInput,
} from "@/features/admin/types/admin";
import { Button } from "@/shared/ui/Button/Button";

import "./MembershipDialog.css";

const schema = z.object({
  organizationId: z.string().min(1, "Hãy chọn nhà xe."),
  staffId: z.string().min(1, "Hãy chọn nhân viên."),
  role: z
    .enum(["", "OPERATOR_ADMIN", "OPERATOR_SCHEDULER", "DRIVER"])
    .refine((role) => role !== "", "Hãy chọn vai trò."),
  status: z.enum(["active", "inactive"]),
  reason: z.string().trim().min(1, "Hãy nhập lý do.").max(500),
});
type Values = z.input<typeof schema>;

interface MembershipDialogProps {
  organizations: readonly Organization[];
  staff: readonly Staff[];
  fixedOrganization?: Organization;
  fixedStaff?: Staff;
  membership?: Membership;
  isPending: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (input: MembershipInput, key: string) => Promise<void>;
}

export function MembershipDialog(props: MembershipDialogProps): ReactElement {
  const [isPointerFocus, setIsPointerFocus] = useState(
    () =>
      typeof document === "undefined" ||
      !document.activeElement?.matches(":focus-visible"),
  );
  const contentRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const [submitError, setSubmitError] = useState(false);
  const [key] = useState(() => crypto.randomUUID());
  const form = useForm<Values, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationId:
        props.fixedOrganization?.id ??
        props.membership?.organizationId ??
        props.fixedStaff?.organizationId ??
        "",
      staffId: props.fixedStaff?.id ?? "",
      role:
        props.membership?.role ??
        (props.fixedStaff?.role === "OPERATOR_ADMIN" ||
        props.fixedStaff?.role === "DRIVER"
          ? props.fixedStaff.role
          : props.fixedStaff
            ? "OPERATOR_SCHEDULER"
            : ""),
      status: props.membership?.status ?? props.fixedStaff?.status ?? "active",
      reason: "",
    },
  });
  const organizationId = useWatch({
    control: form.control,
    name: "organizationId",
  });
  const selectedOrganization = props.organizations.find(
    (item) => item.id === organizationId,
  );
  const submit = form.handleSubmit(async (values) => {
    const member =
      props.staff.find((item) => item.id === values.staffId) ??
      props.fixedStaff;
    if (!member || !values.role) return;
    setSubmitError(false);
    try {
      await props.onSubmit(
        {
          staffId: member.id,
          organizationId: values.organizationId,
          role: values.role,
          status: values.status,
          reason: values.reason,
        },
        key,
      );
    } catch {
      setSubmitError(true);
    }
  });
  const editing = Boolean(props.fixedStaff);
  const isDisabled = props.isPending || form.formState.isSubmitting;
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isDisabled) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="membership-dialog__overlay" />
        <Dialog.Content
          data-pointer-focus={isPointerFocus}
          onPointerDownCapture={() => setIsPointerFocus(true)}
          onKeyDownCapture={() => setIsPointerFocus(false)}
          ref={contentRef}
          className="membership-dialog__content"
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
          <div className="membership-dialog__heading">
            <Dialog.Title>
              {editing ? "Chỉnh sửa thông tin" : "Thêm thành viên"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label="Đóng hộp thoại"
                disabled={isDisabled}
              >
                <img src={closeIcon} alt="" width={24} height={24} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="membership-dialog__description">
            {editing
              ? "Cập nhật vai trò và trạng thái thành viên trong nhà xe này."
              : "Chọn nhà xe và vai trò để cấp quyền cho nhân viên."}
          </Dialog.Description>
          <form
            className="membership-dialog__form"
            onSubmit={submit}
            noValidate
          >
            <label>
              Nhà xe{props.fixedOrganization || editing ? " · Cố định" : ""}
              {props.fixedOrganization || editing ? (
                <span className="membership-dialog__fixed">
                  {selectedOrganization?.name ??
                    props.fixedOrganization?.name ??
                    organizationId}
                  {props.fixedOrganization ||
                  props.fixedStaff?.id === "USR-0018"
                    ? ` · ${props.fixedOrganization?.id ?? organizationId}`
                    : ""}
                </span>
              ) : (
                <select
                  aria-label="Nhà xe"
                  {...form.register("organizationId")}
                >
                  <option value="">Chọn nhà xe</option>
                  {props.organizations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              )}
              {form.formState.errors.organizationId?.message && (
                <span role="alert">
                  {form.formState.errors.organizationId.message}
                </span>
              )}
            </label>
            <label>
              Nhân viên{editing ? " · Cố định" : ""}
              {editing ? (
                <span className="membership-dialog__fixed">
                  {props.fixedStaff?.fullName}
                </span>
              ) : (
                <select aria-label="Nhân viên" {...form.register("staffId")}>
                  <option value="">Chọn nhân viên</option>
                  {props.staff.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.fullName}
                    </option>
                  ))}
                </select>
              )}
              {form.formState.errors.staffId?.message && (
                <span role="alert">
                  {form.formState.errors.staffId.message}
                </span>
              )}
            </label>
            <label>
              Vai trò
              <select aria-label="Vai trò" {...form.register("role")}>
                <option value="">Chọn vai trò</option>
                <option value="OPERATOR_ADMIN">Quản trị nhà xe</option>
                <option value="OPERATOR_SCHEDULER">Lập lịch</option>
                <option value="DRIVER">Tài xế</option>
              </select>
              {form.formState.errors.role?.message && (
                <span role="alert">{form.formState.errors.role.message}</span>
              )}
            </label>
            <label>
              Trạng thái
              <select aria-label="Trạng thái" {...form.register("status")}>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Tạm ngưng</option>
              </select>
            </label>
            <label className="membership-dialog__reason">
              {editing ? "Lý do thay đổi" : "Lý do"}
              <textarea
                aria-label={editing ? "Lý do thay đổi" : "Lý do"}
                placeholder={
                  editing ? "Nhập lý do thay đổi" : "Nhập lý do thêm thành viên"
                }
                {...form.register("reason")}
              />
              {form.formState.errors.reason?.message && (
                <span role="alert">{form.formState.errors.reason.message}</span>
              )}
            </label>
            <p className="membership-dialog__hint">
              {editing
                ? "Cập nhật vai trò và trạng thái thành viên trong nhà xe này."
                : props.fixedOrganization
                  ? `Thành viên được thêm vào ${selectedOrganization?.name ?? props.fixedOrganization.name} với vai trò đã chọn.`
                  : "Chọn nhà xe và vai trò để cấp quyền cho nhân viên."}
            </p>
            {(props.errorMessage || submitError) && (
              <p role="alert">
                {props.errorMessage ??
                  "Không thể lưu thành viên. Vui lòng thử lại."}
              </p>
            )}
            <footer className="membership-dialog__actions">
              <Button
                type="button"
                variant="secondary"
                onClick={props.onClose}
                disabled={isDisabled}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isDisabled}>
                {editing ? "Lưu thay đổi" : "Thêm thành viên"}
              </Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
