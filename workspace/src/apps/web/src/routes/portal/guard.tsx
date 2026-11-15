import { Link, Navigate, Outlet, useLocation } from "react-router";
import type { ReactElement } from "react";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { portal, portalSessionKey } from "@/shared/config/portal";
import { isMockApi } from "@/shared/api/config";
export default function PortalGuard(): ReactElement {
  const { session, isHydrated } = useMockSession();
  const location = useLocation();
  if (!isHydrated) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (!session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  if (isMockApi && window.sessionStorage.getItem(portalSessionKey) !== portal)
    return (
      <section className="guard-state">
        <h1>Phiên đăng nhập không phù hợp</h1>
        <p>Vui lòng đăng nhập bằng tài khoản của cổng này.</p>
        <Link to="/login">Đăng nhập lại</Link>
      </section>
    );
  return <Outlet />;
}
