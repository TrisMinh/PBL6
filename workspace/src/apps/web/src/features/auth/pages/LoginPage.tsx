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
  if (isHydrated && session)
    return (
      <Navigate
        replace
        to={
          isMockApi
            ? safeIntendedRedirect(state?.from, session.role)
            : workspaceRedirect(state?.from)
        }
      />
    );
  return (
    <AuthShell mode="login">
      <LoginForm />
    </AuthShell>
  );
}
