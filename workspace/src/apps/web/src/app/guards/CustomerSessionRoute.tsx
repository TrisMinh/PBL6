import type { ReactElement } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router";

import { GuardLoading } from "@/app/guards/GuardLoading";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { safeIntendedRedirect } from "@/features/auth/lib/intendedRedirect";
import { ROUTES } from "@/shared/config/routes";
import { PageState } from "@/shared/ui/PageState/PageState";

export function CustomerSessionRoute(): ReactElement {
  const { session, isHydrated } = useAccountSession(),
    location = useLocation();
  if (!isHydrated) return <GuardLoading />;
  if (!session?.token)
    return (
      <Navigate
        replace
        to={ROUTES.login}
        state={{
          from: safeIntendedRedirect(
            location.pathname + location.search,
            "customer",
          ),
        }}
      />
    );
  if (session.role !== "customer")
    return (
      <PageState
        title="403 — Không có quyền truy cập"
        description="Trang này dành cho tài khoản khách hàng mô phỏng."
        action={<Link to={ROUTES.home}>Về trang chủ</Link>}
      />
    );
  return <Outlet />;
}
