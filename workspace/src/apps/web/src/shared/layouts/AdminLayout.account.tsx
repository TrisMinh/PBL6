import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { Link, useNavigate } from "react-router";

import staffIcon from "@/assets/admin/staff.svg";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";

export function AdminAccountControl(): ReactElement {
  const { revoke } = useAccountSession();
  const [isOpen, setIsOpen] = useState(false);
  const client = useQueryClient();
  const navigate = useNavigate();
  const logout = (): void => {
    revoke();
    client.removeQueries({ queryKey: ["admin"] });
    setIsOpen(false);
    void navigate(ROUTES.login, { replace: true });
  };
  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label="Tài khoản"
          className="admin-layout__account"
        >
          <img src={staffIcon} alt="" width={20} height={20} />
          <span className="admin-layout__account-label">Tài khoản</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="admin-layout__overlay" />
        <Dialog.Content className="admin-layout__account-dialog">
          <div className="admin-layout__drawer-header">
            <Dialog.Title className="admin-layout__drawer-title">
              Tài khoản quản trị
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" aria-label="Đóng tài khoản">
                <X aria-hidden size={24} />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="admin-layout__drawer-description">
            Phiên đăng nhập quản trị BLUE.
          </Dialog.Description>
          <Link to={ROUTES.home} onClick={() => setIsOpen(false)}>
            Trang đặt vé →
          </Link>
          <Button type="button" onClick={logout}>
            Đăng xuất
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
