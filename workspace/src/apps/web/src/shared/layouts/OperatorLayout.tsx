import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { List } from "@phosphor-icons/react/dist/csr/List";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { logoutApi } from "@/shared/api/client";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { NotificationBell } from "@/features/notifications/NotificationBell";
import { isMockApi } from "@/shared/api/config";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";
import { Button } from "@/shared/ui/Button/Button";
import tripsIcon from "@/assets/operator/schedule/imgFrame1.svg";
import bookingsIcon from "@/assets/operator/schedule/imgFrame2.svg";
import routesIcon from "@/assets/operator/schedule/imgFrame3.svg";
import seatsIcon from "@/assets/operator/schedule/imgFrame4.svg";
import driversIcon from "@/assets/operator/schedule/imgFrame5.svg";
import reportsIcon from "@/assets/operator/schedule/imgFrame6.svg";
import membersIcon from "@/assets/operator/schedule/imgFrame7.svg";
import refundsIcon from "@/assets/operator/schedule/imgFrame8.svg";
import "./OperatorLayout.css";
import "./OperatorTheme.css";
import "./OperatorConsistency.css";
import "./OperatorMotion.css";
import { driverOnly, workspaceAccess } from "@/features/auth/lib/workspaceAccess";
import { OperatorWorkspaceContext } from "./OperatorWorkspaceContext";
import { OperatorAccountAvatar } from "@/features/operator/components/OperatorAccountAvatar";

const groups = [
  {
    label: "VẬN HÀNH",
    links: [
      { to: "/operator/trips", label: "Chuyến đi", icon: tripsIcon },
      {
        to: "/operator/bookings",
        label: "Đặt chỗ & giao dịch",
        icon: bookingsIcon,
      },
      {
        to: "/operator/refund-requests",
        label: "Hủy vé & hoàn tiền",
        icon: refundsIcon,
      },
    ],
  },
  {
    label: "TÀI NGUYÊN",
    links: [
      { to: "/operator/routes", label: "Tuyến & điểm dừng", icon: routesIcon },
      { to: "/operator/vehicles", label: "Xe & sơ đồ ghế", icon: seatsIcon },
      { to: "/operator/drivers", label: "Tài xế", icon: driversIcon },
    ],
  },
  {
    label: "QUẢN TRỊ",
    links: [
      { to: "/operator/settlements", label: "Đối soát", icon: bookingsIcon },
      { to: "/operator/reports", label: "Báo cáo", icon: reportsIcon },
      {
        to: "/operator/organization",
        label: "Hồ sơ nhà xe",
        icon: membersIcon,
      },
    ],
  },
];
function OperatorNavigation({
  onNavigate,
}: {
  onNavigate?: () => void;
}): ReactElement {
  const location = useLocation();
  return (
    <nav aria-label="Điều hướng nhà xe">
      {groups.map((group) => (
        <section key={group.label}>
          <h2>{group.label}</h2>
          {group.links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                [
                  "operator-workspace__nav-link",
                  (link.to.includes("?")
                    ? location.search.includes("view=organization")
                    : isActive &&
                      !(
                        link.to === "/operator/trips" &&
                        location.search.includes("view=organization")
                      )) && "is-active",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <img src={link.icon} width={16} height={16} alt="" />
              {link.label}
            </NavLink>
          ))}
        </section>
      ))}
    </nav>
  );
}
function LiveOperatorLayout(): ReactElement {
  const { session, isHydrated, revoke } = useAccountSession();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
  const mainRef = useRef<HTMLElement>(null);
  const ready = isHydrated && Boolean(session);

  useEffect(() => {
    const main = mainRef.current;
    if (!ready || !main?.animate) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (preference.matches) return;
    const animation = main.animate([{ opacity: 0.72 }, { opacity: 1 }], {
      duration: 200,
      easing: "cubic-bezier(0.2, 0.75, 0.3, 1)",
    });
    const stop = (): void => animation.cancel();
    preference.addEventListener("change", stop);
    return () => {
      preference.removeEventListener("change", stop);
      stop();
    };
  }, [location.pathname, ready]);

  if (!isHydrated)
    return (
      <div className="operator-workspace__loading" role="status">
        Đang mở không gian nhà xe…
      </div>
    );
  if (!session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (!workspaceAccess().operator)
    return (
      <main className="operator-access" aria-labelledby="operator-access-title">
        <Link
          to="/"
          aria-label="BLUE — Trang chủ"
          className="operator-access__brand"
        >
          <BrandLogo placement="header" />
        </Link>
        <section className="operator-access__card">
          <div className="operator-access__icon" aria-hidden="true">
            <LockKey size={38} weight="duotone" />
          </div>
          <p className="operator-access__eyebrow">KHÔNG GIAN NHÀ XE</p>
          <h1 id="operator-access-title">Bạn chưa có quyền truy cập</h1>
          <p className="operator-access__description">
            Tài khoản hiện tại không có quyền quản lý nhà xe. Đăng nhập bằng tài
            khoản nhà xe để tiếp tục.
          </p>
          <div className="operator-access__actions">
            <Button
              isLoading={switching}
              onClick={async () => {
                if (switching) return;
                setSwitching(true);
                await logoutApi().catch(() => undefined);
                void navigate("/login", {
                  state: { from: location.pathname + location.search },
                });
              }}
            >
              Đăng nhập tài khoản nhà xe
            </Button>
            <Link to="/">Về trang chủ</Link>
          </div>
        </section>
      </main>
    );
  if (driverOnly()) {
    if (location.pathname !== "/operator/my-trips")
      return <Navigate to="/operator/my-trips" replace />;
    return <Outlet />;
  }
  const section = groups
    .flatMap((group) => group.links)
    .find(
      (link) => !link.to.includes("?") && location.pathname.startsWith(link.to),
    );
  return (
    <div
      className={[
        "operator-workspace",
        location.pathname === "/operator/vehicles" &&
          "operator-workspace--vehicles",
        location.pathname.startsWith("/operator/routes") &&
          "operator-workspace--routes",
        location.pathname === "/operator/reports" &&
          "operator-workspace--reports",
        location.pathname.startsWith("/operator/drivers") &&
          "operator-workspace--drivers",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <a className="operator-workspace__skip" href="#operator-main">
        Đến nội dung chính
      </a>
      <aside className="operator-workspace__sidebar">
        <Link
          to="/operator/trips"
          aria-label="BLUE — Lịch chuyến"
          className="operator-workspace__brand"
        >
          <BrandLogo placement="header" />
        </Link>
        <OperatorNavigation />
        <div className="operator-workspace__account">
          <span aria-hidden="true">OP</span>
          <div>
            <strong>Không gian nhà xe</strong>
            <small>BLUE · Vận hành</small>
          </div>
        </div>
        <Button variant="ghost" onClick={revoke}>
          Đăng xuất
        </Button>
      </aside>
      <div className="operator-workspace__frame">
        <header className="operator-workspace__topbar">
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <Button
                variant="ghost"
                className="operator-workspace__menu"
                aria-label="Mở menu nhà xe"
              >
                <List size={22} />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="operator-workspace__overlay" />
              <Dialog.Content className="operator-workspace__drawer">
                <div className="operator-workspace__drawer-header">
                  <Dialog.Title>Quản lý nhà xe</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" aria-label="Đóng menu nhà xe">
                      <X size={22} />
                    </Button>
                  </Dialog.Close>
                </div>
                <Dialog.Description>
                  Điều hướng giữa lịch chuyến, tài nguyên và giao dịch.
                </Dialog.Description>
                <OperatorNavigation onNavigate={() => setOpen(false)} />
                <Button variant="ghost" onClick={revoke}>
                  Đăng xuất
                </Button>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
          <div>
            <span>Không gian làm việc</span>
            {location.pathname.replace(/\/$/, "") === "/operator/drivers" ? (
              <h1>Quản lý tài xế</h1>
            ) : (
              <strong>{section?.label ?? "Quản lý nhà xe"}</strong>
            )}
          </div>
          <div className="operator-workspace__top-actions">
            <NotificationBell />
            <OperatorAccountAvatar />
          </div>
        </header>
        <main
          ref={mainRef}
          id="operator-main"
          className="operator-workspace__main"
          tabIndex={-1}
        >
          <OperatorWorkspaceContext.Provider value={true}>
            <Outlet />
          </OperatorWorkspaceContext.Provider>
        </main>
      </div>
    </div>
  );
}
export function OperatorLayout(): ReactElement {
  return isMockApi ? <Outlet /> : <LiveOperatorLayout />;
}
