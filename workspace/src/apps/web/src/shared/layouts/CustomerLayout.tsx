import { isMockApi } from "@/shared/api/config";
import { List as Menu } from "@phosphor-icons/react/dist/csr/List";
import { X } from "@phosphor-icons/react/dist/csr/X";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactElement } from "react";
import { Link, matchPath, NavLink, Outlet, useLocation } from "react-router";

import { NotificationBell } from "@/features/notifications/NotificationBell";
import { BREAKPOINTS } from "@/shared/config/breakpoints";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

import "./CustomerLayout.css";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { workspaceAccess } from "@/features/auth/lib/workspaceAccess";

function AccountWorkspaceLink({
  onNavigate,
  className,
}: {
  onNavigate?: () => void;
  className?: string;
}): ReactElement {
  const { session, isHydrated } = useMockSession();
  const access =
    isHydrated && session
      ? isMockApi && session.role === "admin"
        ? { home: ROUTES.adminOrganizations, label: "Quản trị hệ thống" }
        : workspaceAccess()
      : { home: ROUTES.accountTickets, label: "Hành trình của tôi" };
  return (
    <Link className={className} to={access.home} onClick={onNavigate}>
      {access.label}
    </Link>
  );
}

const CUSTOMER_NAV_ITEMS = [
  { label: "Trang chủ", to: ROUTES.home },
  { label: "Khám phá", to: ROUTES.explore },
  { label: "Điểm đến", to: ROUTES.trips },
  {
    label: "Vé xe",
    to: isMockApi ? ROUTES.ticketLookup : ROUTES.accountTickets,
  },
];

interface CustomerNavigationProps {
  label: string;
  onNavigate?: () => void;
}

function CustomerNavigation({
  label,
  onNavigate,
}: CustomerNavigationProps): ReactElement {
  return (
    <nav aria-label={label}>
      <ul className="customer-layout__nav-list">
        {CUSTOMER_NAV_ITEMS.map(({ label: linkLabel, to }) => (
          <li key={to}>
            <NavLink
              className="customer-layout__nav-link"
              end={to !== ROUTES.explore}
              onClick={onNavigate}
              to={to}
            >
              {linkLabel}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function CustomerDrawer({
  onNavigate,
}: Pick<CustomerNavigationProps, "onNavigate">): ReactElement {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="customer-layout__overlay" />
      <Dialog.Content className="customer-layout__drawer">
        <div className="customer-layout__drawer-header">
          <Dialog.Title className="customer-layout__drawer-title">
            Menu BLUE
          </Dialog.Title>
          <Dialog.Close asChild>
            <Button
              aria-label="Đóng menu"
              className="customer-layout__close-button"
              type="button"
              variant="ghost"
            >
              <X aria-hidden size={24} />
            </Button>
          </Dialog.Close>
        </div>
        <Dialog.Description className="customer-layout__drawer-description">
          Tìm chuyến, tra cứu vé hoặc đăng nhập tài khoản.
        </Dialog.Description>
        <CustomerNavigation label="Điều hướng mobile" onNavigate={onNavigate} />
        <div className="customer-layout__drawer-actions">
          <AccountWorkspaceLink onNavigate={onNavigate} />
          <Link
            className="customer-layout__booking-link"
            to={ROUTES.home}
            onClick={onNavigate}
          >
            Tìm chuyến và đặt vé
          </Link>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

function CustomerMobileMenu(): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const desktopQuery = window.matchMedia(
      `(min-width: ${BREAKPOINTS.customerNavigation}px)`,
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
          aria-label="Mở menu"
          className="customer-layout__menu-button"
          type="button"
          variant="ghost"
        >
          <Menu aria-hidden size={24} />
        </Button>
      </Dialog.Trigger>
      <CustomerDrawer onNavigate={() => setIsOpen(false)} />
    </Dialog.Root>
  );
}

function CustomerHeader(): ReactElement {
  return (
    <header className="customer-layout__header">
      <div className="customer-layout__header-inner">
        <Link
          aria-label="BLUE — Trang chủ"
          className="customer-layout__logo"
          to={ROUTES.home}
        >
          <BrandLogo placement="header" />
        </Link>
        <div className="customer-layout__desktop-nav">
          <CustomerNavigation label="Điều hướng chính" />
        </div>
        <div className="customer-layout__actions">
          <AccountWorkspaceLink className="customer-layout__journey-link" />
          <div className="customer-layout__notification-slot">
            <NotificationBell />
          </div>
          <Link className="customer-layout__booking-link" to={ROUTES.trips}>
            Đặt vé
          </Link>
        </div>
        <CustomerMobileMenu />
      </div>
    </header>
  );
}

export function CustomerLayout(): ReactElement {
  const location = useLocation();
  const isAuthFrame =
    location.pathname === ROUTES.login ||
    location.pathname === ROUTES.register ||
    location.pathname === ROUTES.forgotPassword;
  const isHome = location.pathname === ROUTES.home;
  const isSeatFrame = Boolean(
    matchPath(
      { path: "/booking/:sessionId/seats", end: true },
      location.pathname,
    ),
  );
  const isPassengerOrReviewFrame = [
    "/booking/:sessionId/passengers",
    "/booking/:sessionId/review",
  ].some((path) => Boolean(matchPath({ path, end: true }, location.pathname)));
  const isPaymentFrame = [
    "/payment/:bookingId/vnpay",
    "/payment/vnpay/return",
  ].some((path) => Boolean(matchPath({ path, end: true }, location.pathname)));
  const isTicketDetailFrame =
    location.pathname !== ROUTES.ticketLookup &&
    Boolean(
      matchPath({ path: "/tickets/:ticketCode", end: true }, location.pathname),
    );
  const isCancellationFrame = Boolean(
    matchPath(
      { path: "/bookings/:bookingCode/cancel", end: true },
      location.pathname,
    ),
  );
  const routeOwnsFooterOrFrame =
    isHome ||
    location.pathname === ROUTES.trips ||
    isSeatFrame ||
    isPassengerOrReviewFrame ||
    isPaymentFrame ||
    isTicketDetailFrame ||
    isCancellationFrame;
  const classNames = [
    "customer-layout",
    isAuthFrame ? "customer-layout--auth-frame" : "",
    isHome ? "customer-layout--home" : "",
    isPassengerOrReviewFrame ? "customer-layout--booking-detail-frame" : "",
    isPaymentFrame || isTicketDetailFrame || isCancellationFrame
      ? "customer-layout--route-owned-frame"
      : "",
    isCancellationFrame ? "customer-layout--cancellation-frame" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const mainClassNames = [
    "customer-layout__main",
    isAuthFrame ? "customer-layout__main--route-owned" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classNames}>
      <a className="customer-layout__skip-link" href="#main-content">
        Đến nội dung chính
      </a>
      {isAuthFrame ? null : <CustomerHeader />}
      <main className={mainClassNames} id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      {routeOwnsFooterOrFrame || isAuthFrame ? null : (
        <footer className="customer-layout__footer">
          <div className="customer-layout__footer-content">
            <BrandLogo placement="footer" />
            <p>Đi đúng chuyến, đặt đúng ghế.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
