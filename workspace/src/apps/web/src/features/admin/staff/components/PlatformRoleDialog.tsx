import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactElement } from "react";
import { useForm } from "react-hook-form";

import closeIcon from "@/assets/admin/close-member.svg";
import { useSaveStaff } from "@/features/admin/staff/hooks/useStaffData";
import type { Staff } from "@/features/admin/types/admin";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

import "./MembershipDialog.css";

export function PlatformRoleDialog({
  staff,
  onClose,
  onSaved,
}: {
  staff: Staff;
  onClose: () => void;
  onSaved: () => void;
}): ReactElement {
  const save = useSaveStaff();
  const form = useForm<{ reason: string }>({ defaultValues: { reason: "" } });
  const contentRef = useRef<HTMLDivElement | null>(null);
  const returnFocusRef = useRef(
    typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const isPending = save.isPending || form.formState.isSubmitting;
  const submit = form.handleSubmit(async ({ reason }) => {
    try {
      await save.mutateAsync({
        id: staff.id,
        input: {
          organizationId: staff.organizationId,
          fullName: staff.fullName,
          email: staff.email,
          phone: staff.phone,
          role: "PLATFORM_SUPPORT",
          status: staff.status,
          membershipReason: reason.trim(),
        },
      });
      onSaved();
      onClose();
    } catch {
      form.setError("root", {
        message: "Không thể lưu vai trò. Vui lòng thử lại.",
      });
    }
  });
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="membership-dialog__overlay" />
        <Dialog.Content
          ref={contentRef}
          className="membership-dialog__content"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            if (returnFocusRef.current) {
              event.preventDefault();
              returnFocusRef.current.focus();
            }
          }}
        >
          <div className="membership-dialog__heading">
            <Dialog.Title>Vai trò nền tảng</Dialog.Title>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                type="button"
                aria-label="Đóng hộp thoại"
                disabled={isPending}
              >
                <img src={closeIcon} alt="" width={24} height={24} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description>
            Quyền hỗ trợ được áp dụng trong phạm vi nền tảng BLUE.
          </Dialog.Description>
          <form
            onSubmit={submit}
            noValidate
            className="membership-dialog__form"
          >
            <p>{staff.fullName} · PLATFORM_SUPPORT</p>
            <Input
              label="Lý do thay đổi"
              maxLength={500}
              error={form.formState.errors.reason?.message}
              {...form.register("reason", {
                validate: (value) =>
                  value.trim().length > 0 || "Hãy nhập lý do.",
              })}
            />
            {form.formState.errors.root?.message && (
              <p role="alert">{form.formState.errors.root.message}</p>
            )}
            <footer className="membership-dialog__actions">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={onClose}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={isPending}>
                Lưu thay đổi
              </Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
