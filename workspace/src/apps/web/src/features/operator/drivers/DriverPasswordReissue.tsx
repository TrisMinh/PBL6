import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactElement } from "react";
import { ApiError, publicActionError } from "@/shared/api/error";
import { Button } from "@/shared/ui/Button/Button";
import {
  DriverCredentials,
  type DriverCredentialsData,
} from "./DriverCredentials";
import { reissueDriverPassword } from "./driversRepository";

export function DriverPasswordReissue({
  membershipId,
  name,
}: {
  membershipId: string;
  name: string;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [credentials, setCredentials] = useState<DriverCredentialsData | null>(
    null,
  );
  const [error, setError] = useState("");

  function changeOpen(next: boolean): void {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setCredentials(null);
      setError("");
    }
  }

  async function reissue(): Promise<void> {
    setPending(true);
    setError("");
    try {
      setCredentials(await reissueDriverPassword(membershipId));
    } catch (reason) {
      setError(
        reason instanceof ApiError && reason.status === 409
          ? "Chưa thể cấp lại mật khẩu. Kiểm tra trạng thái và quyền của tài khoản rồi thử lại."
          : publicActionError(reason),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Trigger asChild>
        <Button variant="secondary">Cấp lại mật khẩu</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="operator-drivers__overlay" />
        <Dialog.Content
          className="operator-drivers__dialog driver-password-reissue"
          onInteractOutside={(event) => {
            if (credentials) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (credentials) event.preventDefault();
          }}
        >
          <Dialog.Title>
            {credentials ? "Đã cấp lại mật khẩu" : "Cấp lại mật khẩu"}
          </Dialog.Title>
          <Dialog.Description>
            {credentials
              ? "Bàn giao thông tin này cho tài xế trước khi đóng."
              : `Cấp mật khẩu mới cho ${name}? Mật khẩu cũ sẽ hết hiệu lực.`}
          </Dialog.Description>
          {credentials && <DriverCredentials credentials={credentials} />}
          {error && <p role="alert">{error}</p>}
          <footer>
            <Dialog.Close asChild>
              <Button
                variant={credentials ? "primary" : "secondary"}
                disabled={pending}
              >
                {credentials ? "Hoàn tất" : "Hủy"}
              </Button>
            </Dialog.Close>
            {!credentials && (
              <Button isLoading={pending} onClick={() => void reissue()}>
                Xác nhận cấp lại
              </Button>
            )}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
