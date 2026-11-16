import { OperatorSidebar } from "@/features/operator/components/OperatorSidebar";
import "@/features/operator/schedule/SchedulePage.css";
import { useState, type ReactElement } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router";
import { LockKey } from "@phosphor-icons/react/dist/csr/LockKey";
import { logoutApi } from "@/shared/api/client";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { isMockApi } from "@/shared/api/config";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";
import { Button } from "@/shared/ui/Button/Button";
import "./OperatorLayout.css";
import { workspaceAccess } from "@/features/auth/lib/workspaceAccess";

function LiveOperatorLayout(): ReactElement {
  const { session, isHydrated } = useAccountSession();
  const location = useLocation();
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();
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
  const originalPage =
    (location.pathname.startsWith("/operator/trips") &&
      !location.search.includes("view=organization")) ||
    (location.pathname === "/operator/bookings" &&
      !location.search.includes("refundBooking="));
  if (originalPage) return <Outlet />;
  const modifier = location.pathname.startsWith("/operator/vehicles")
    ? "operator-workspace--vehicles"
    : location.pathname.startsWith("/operator/routes")
      ? "operator-workspace--routes"
      : location.pathname.startsWith("/operator/drivers")
        ? "operator-workspace--drivers"
        : location.pathname === "/operator/reports"
          ? "operator-workspace--reports"
          : "";
  return (
    <div className={`operator-schedule ${modifier}`}>
      <OperatorSidebar />
      <main
        id="operator-main"
        className="operator-schedule__main"
        tabIndex={-1}
      >
        <Outlet />
      </main>
    </div>
  );
}

export function OperatorLayout(): ReactElement {
  return isMockApi ? <Outlet /> : <LiveOperatorLayout />;
}
