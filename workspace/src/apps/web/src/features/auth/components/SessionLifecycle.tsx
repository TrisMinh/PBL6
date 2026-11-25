import { useEffect, useState, type ReactElement } from "react";
import { useNavigate } from "react-router";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { refreshAccessToken } from "@/shared/api/client";
import { API_SESSION_EXPIRED, readApiSession } from "@/shared/api/session";
import { ROUTES } from "@/shared/config/routes";
import { Toast } from "@/shared/ui/Toast/Toast";

export function SessionLifecycle(): ReactElement | null {
  const { session } = useAccountSession();
  const navigate = useNavigate();
  const [expired, setExpired] = useState(false);
  const token = session?.token;

  useEffect(() => {
    const show = (): void => {
      setExpired(true);
      void navigate(ROUTES.login, { replace: true });
    };
    window.addEventListener(API_SESSION_EXPIRED, show);
    return () => window.removeEventListener(API_SESSION_EXPIRED, show);
  }, [navigate]);

  useEffect(() => {
    const stored = readApiSession();
    if (!token || stored?.accessToken !== token) return;
    const refreshAt =
      stored.expiresAt - Math.min(60_000, stored.expiresIn * 250);
    let nextAttempt = refreshAt;
    let timer: number;
    let active = true;
    let running = false;
    const refreshIfDue = (): void => {
      if (!active || running || readApiSession()?.accessToken !== token) return;
      window.clearTimeout(timer);
      if (Date.now() < nextAttempt) {
        timer = window.setTimeout(refreshIfDue, nextAttempt - Date.now());
        return;
      }
      running = true;
      void refreshAccessToken().catch(() => {
        // Connection failures are retried without discarding a valid refresh token.
        running = false;
        nextAttempt = Date.now() + 15_000;
        refreshIfDue();
      });
    };
    const onVisibility = (): void => {
      if (document.visibilityState === "visible") refreshIfDue();
    };
    refreshIfDue();
    window.addEventListener("focus", refreshIfDue);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("focus", refreshIfDue);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token]);

  return expired && !session ? (
    <Toast
      tone="error"
      message="Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại."
      onClose={() => setExpired(false)}
    />
  ) : null;
}
