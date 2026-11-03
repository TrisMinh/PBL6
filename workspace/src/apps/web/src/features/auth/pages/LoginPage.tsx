import type { ReactElement } from "react";

import { AuthShell } from "@/features/auth/components/AuthShell";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { Navigate, useLocation } from "react-router";
import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { workspaceRedirect } from "@/features/auth/lib/workspaceAccess";
import { safeIntendedRedirect } from "@/features/auth/lib/intendedRedirect";
import { isMockApi } from "@/shared/api/config";

export function LoginPage(): ReactElement {
  const { session, isHydrated } = useMockSession();
  const { state } = useLocation();
  if (isHydrated && session) {
    const target = isMockApi
      ? safeIntendedRedirect(state?.from, session.role)
      : workspaceRedirect(state?.from);
    return (
      <Navigate
        replace
        to={target}
        state={
          !isMockApi && target === state?.from && target.startsWith("/trips")
            ? { bookingIntent: state?.bookingIntent }
            : null
        }
      />
    );
  }
  return (
    <AuthShell mode="login">
      <LoginForm />
    </AuthShell>
  );
}
