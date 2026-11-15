import { SignOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { GearSix } from "@phosphor-icons/react/dist/csr/GearSix";
import { Ticket } from "@phosphor-icons/react/dist/csr/Ticket";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { ReactElement } from "react";
import { Link, useNavigate } from "react-router";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import {
  defaultCustomerAvatar,
  useCustomerAvatar,
} from "@/features/account/customerAvatar";

export function CustomerAccountMenu({
  onNavigate,
}: { onNavigate?: () => void } = {}): ReactElement {
  const { revoke, session } = useAccountSession();
  const avatar = useCustomerAvatar(session?.userId);
  const navigate = useNavigate();
  const items =
    session?.role === "customer"
      ? [
          {
            label: "Hồ sơ cá nhân",
            to: ROUTES.accountProfile,
            Icon: UserCircle,
          },
          { label: "Vé của tôi", to: ROUTES.accountTickets, Icon: Ticket },
          { label: "Cài đặt", to: ROUTES.accountSettings, Icon: GearSix },
        ]
      : [];
  function logout(): void {
    revoke();
    onNavigate?.();
    void navigate(ROUTES.login, { replace: true });
  }

  if (onNavigate) {
    return (
      <>
        {items.map(({ label, to }) => (
          <Link to={to} key={to} onClick={onNavigate}>
            {label}
          </Link>
        ))}
        <Button type="button" variant="secondary" onClick={logout}>
          <SignOut size={18} aria-hidden /> Đăng xuất
        </Button>
      </>
    );
  }

  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger
        className="customer-account__trigger"
        type="button"
        aria-label="Tài khoản"
        title="Tài khoản"
      >
        <img
          className="customer-account__avatar"
          src={avatar || defaultCustomerAvatar}
          alt=""
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="customer-account__menu"
          align="end"
          sideOffset={10}
        >
          <DropdownMenu.Label className="customer-account__label">
            Tài khoản
          </DropdownMenu.Label>
          {items.map(({ label, to, Icon }) => (
            <DropdownMenu.Item key={to} asChild>
              <Link className="customer-account__item" to={to}>
                <Icon size={18} aria-hidden /> {label}
              </Link>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Item
            className="customer-account__item customer-account__logout"
            onSelect={logout}
          >
            <SignOut size={18} aria-hidden /> Đăng xuất
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
