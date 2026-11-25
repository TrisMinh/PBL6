import * as Dialog from "@radix-ui/react-dialog";
import { useState, type FormEvent, type ReactElement } from "react";
import { z } from "zod";
import { apiJson } from "@/shared/api/client";
import { ApiError, publicActionError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import { Input } from "@/shared/ui/Input/Input";

export function DriverPasswordDialog({
  onChanged,
}: {
  onChanged: () => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [changed, setChanged] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const currentPassword = String(values.get("currentPassword"));
    const newPassword = String(values.get("newPassword"));
    if (newPassword !== values.get("confirmPassword")) {
      setError("Hai mật khẩu mới chưa khớp.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Hãy chọn mật khẩu mới khác mật khẩu hiện tại.");
      return;
    }

    setError("");
    setPending(true);
    try {
      await apiJson("/api/v1/users/me/password", z.unknown(), {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      form.reset();
      setChanged(true);
    } catch (reason) {
      const field =
        reason instanceof ApiError
          ? z.object({ field: z.string() }).safeParse(reason.details).data
              ?.field
          : undefined;
      setError(
        field === "currentPassword"
          ? "Mật khẩu hiện tại chưa đúng."
          : reason instanceof ApiError && reason.status === 422
            ? "Mật khẩu mới cần ít nhất 10 ký tự, gồm chữ và số."
            : publicActionError(reason),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending || changed) return;
        setError("");
        setOpen(next);
      }}
    >
      <Dialog.Trigger asChild>
        <Button variant="ghost">Đổi mật khẩu</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="driver-password__overlay" />
        <Dialog.Content className="driver-password__dialog">
          <Dialog.Title>Đổi mật khẩu</Dialog.Title>
          <Dialog.Description>
            {changed
              ? "Đã lưu mật khẩu mới. Vui lòng đăng nhập lại."
              : "Mật khẩu mới cần ít nhất 10 ký tự, gồm chữ và số."}
          </Dialog.Description>
          {changed ? (
            <Button onClick={onChanged}>Đăng nhập lại</Button>
          ) : (
            <form onSubmit={(event) => void submit(event)}>
              <Input
                label="Mật khẩu hiện tại"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
              />
              <Input
                label="Mật khẩu mới"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
              />
              <Input
                label="Nhập lại mật khẩu mới"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                required
              />
              {error && <p role="alert">{error}</p>}
              <div className="driver-password__actions">
                <Dialog.Close asChild>
                  <Button type="button" variant="secondary" disabled={pending}>
                    Hủy
                  </Button>
                </Dialog.Close>
                <Button type="submit" isLoading={pending}>
                  Lưu mật khẩu
                </Button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
