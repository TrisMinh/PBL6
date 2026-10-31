import type { ReactElement } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";

import { GuardLoading } from "@/app/guards/GuardLoading";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { safeIntendedRedirect } from "@/features/auth/lib/intendedRedirect";
import { ROUTES } from "@/shared/config/routes";

export function AdminRoute(): ReactElement {
  const { session, isHydrated } = useMockSession();
  const location = useLocation();
  if (!isHydrated) return <GuardLoading />;
  if (!session)
    return (
      <Navigate
        replace
        to={ROUTES.login}
        state={{ from: safeIntendedRedirect(location.pathname, "admin") }}
      />
    );
  if (session.role !== "admin") {
    return (
      <section aria-labelledby="admin-forbidden-title" className="guard-state">
        <h1 id="admin-forbidden-title">403 — Không có quyền truy cập</h1>
        <p>Tài khoản này không có quyền quản trị.</p>
        <Link className="guard-state__link" to={ROUTES.home}>
          Về trang chủ
        </Link>
      </section>
    );
  }
  return <Outlet />;
}
