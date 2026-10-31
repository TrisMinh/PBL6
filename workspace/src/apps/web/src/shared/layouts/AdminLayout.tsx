import { List as Menu } from "@phosphor-icons/react/dist/csr/List";
import { X } from "@phosphor-icons/react/dist/csr/X";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactElement } from "react";
import { Link, NavLink, Outlet } from "react-router";

import organizationIcon from "@/assets/admin/org.svg";
import organizationActiveIcon from "@/assets/admin/org-active.svg";
import staffIcon from "@/assets/admin/staff.svg";
import staffActiveIcon from "@/assets/admin/staff-active.svg";
import bookingIcon from "@/assets/admin/booking.svg";
import paymentIcon from "@/assets/admin/payment.svg";
import refundIcon from "@/assets/admin/refund.svg";
import bookingActiveIcon from "@/assets/admin/booking-active.svg";
import paymentActiveIcon from "@/assets/admin/payment-active.svg";
import refundActiveIcon from "@/assets/admin/refund-active.svg";
import transactionOrgIcon from "@/assets/admin/transaction-nav-org.svg";
import transactionStaffIcon from "@/assets/admin/transaction-nav-staff.svg";
import transactionBookingIcon from "@/assets/admin/transaction-nav-booking.svg";
import transactionPaymentIcon from "@/assets/admin/transaction-nav-payment.svg";
import transactionRefundIcon from "@/assets/admin/transaction-nav-refund.svg";
import { BREAKPOINTS } from "@/shared/config/breakpoints";
import { ROUTES } from "@/shared/config/routes";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";
import { Button } from "@/shared/ui/Button/Button";
import { AdminAccountControl } from "./AdminLayout.account";

import "./AdminLayout.css";

const ADMIN_NAV_ITEMS = [
  {
    label: "Tổ chức",
    to: ROUTES.adminOrganizations,
    icon: organizationIcon,
    activeIcon: organizationActiveIcon,
    transactionIcon: transactionOrgIcon,
  },
  {
    label: "Nhân viên",
    to: ROUTES.adminStaff,
    icon: staffIcon,
    activeIcon: staffActiveIcon,
    transactionIcon: transactionStaffIcon,
  },
  {
    label: "Đơn đặt vé",
    to: ROUTES.adminBookings,
    icon: bookingIcon,
    activeIcon: bookingActiveIcon,
    transactionIcon: transactionBookingIcon,
  },
  {
    label: "Thanh toán",
    to: ROUTES.adminPayments,
    icon: paymentIcon,
    activeIcon: paymentActiveIcon,
    transactionIcon: transactionPaymentIcon,
  },
  {
    label: "Hoàn tiền",
    to: ROUTES.adminRefunds,
    icon: refundIcon,
    activeIcon: refundActiveIcon,
    transactionIcon: transactionRefundIcon,
  },
];

interface AdminNavigationProps {
  label: string;
  onNavigate?: () => void;
}

function AdminNavigation({
  label,
  onNavigate,
}: AdminNavigationProps): ReactElement {
  return (
    <nav aria-label={label}>
      <ul className="admin-layout__nav-list">
        {ADMIN_NAV_ITEMS.map(
          ({ label: linkLabel, to, icon, activeIcon, transactionIcon }) => (
            <li key={to}>
              <NavLink
                className="admin-layout__nav-link"
                onClick={onNavigate}
                to={to}
              >
                {({ isActive }) => (
                  <>
                    <img
                      className="admin-layout__nav-icon--default"
                      src={isActive ? activeIcon : icon}
                      alt=""
                      width={20}
                      height={20}
                    />
                    <img
                      className="admin-layout__nav-icon--transaction"
                      src={
                        isActive && to !== ROUTES.adminBookings
                          ? activeIcon
                          : transactionIcon
                      }
                      alt=""
                      width={20}
                      height={20}
                    />
                    {linkLabel}
                  </>
                )}
              </NavLink>
            </li>
          ),
        )}
      </ul>
    </nav>
  );
}

function AdminDrawer({
  onNavigate,
}: Pick<AdminNavigationProps, "onNavigate">): ReactElement {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="admin-layout__overlay" />
      <Dialog.Content className="admin-layout__drawer">
        <div className="admin-layout__drawer-header">
          <Dialog.Title className="admin-layout__drawer-title">
            Menu quản trị
          </Dialog.Title>
          <Dialog.Close asChild>
            <Button
              aria-label="Đóng menu quản trị"
              className="admin-layout__close-button"
              type="button"
              variant="ghost"
            >
              <X aria-hidden size={24} />
            </Button>
          </Dialog.Close>
        </div>
        <Dialog.Description className="admin-layout__drawer-description">
          Điều hướng các khu vực quản trị BLUE.
        </Dialog.Description>
        <AdminNavigation
          label="Điều hướng quản trị mobile"
          onNavigate={onNavigate}
        />
      </Dialog.Content>
    </Dialog.Portal>
  );
}

function AdminMobileMenu(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia(
      `(min-width: ${BREAKPOINTS.adminNavigation}px)`,
    );
    const closeOnDesktop = (): void => {
      if (desktopQuery.matches) setIsOpen(false);
    };
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => desktopQuery.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Dialog.Root onOpenChange={setIsOpen} open={isOpen}>
      <Dialog.Trigger asChild>
        <Button
          aria-expanded={isOpen}
          aria-label="Mở menu quản trị"
          className="admin-layout__menu-button"
          type="button"
          variant="ghost"
        >
          <Menu aria-hidden size={24} />
        </Button>
      </Dialog.Trigger>
      <AdminDrawer onNavigate={() => setIsOpen(false)} />
    </Dialog.Root>
  );
}

function AdminHeader(): ReactElement {
  return (
    <header className="admin-layout__header">
      <Link
        aria-label="BLUE — Quản trị"
        className="admin-layout__logo"
        to={ROUTES.adminOrganizations}
      >
        <BrandLogo placement="header" />
      </Link>
      <div className="admin-layout__desktop-navigation">
        <AdminNavigation label="Điều hướng quản trị" />
      </div>
      <AdminAccountControl />
      <AdminMobileMenu />
    </header>
  );
}

export function AdminLayout(): ReactElement {
  return (
    <div className="admin-layout">
      <a className="admin-layout__skip-link" href="#admin-main-content">
        Đến nội dung quản trị
      </a>
      <AdminHeader />
      <div className="admin-layout__body">
        <main
          className="admin-layout__main"
          id="admin-main-content"
          tabIndex={-1}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
