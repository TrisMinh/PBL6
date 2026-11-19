import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState, type ReactElement } from "react";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { refreshAccessToken } from "@/shared/api/client";
import { API_SESSION_EXPIRED, readApiSession } from "@/shared/api/session";
import { ROUTES } from "@/shared/config/routes";
import { Button } from "@/shared/ui/Button/Button";
import "./SessionLifecycle.css";

export function SessionLifecycle(): ReactElement {
  const { session } = useAccountSession();
  const [expired, setExpired] = useState(false);
  const token = session?.token;

  useEffect(() => {
    const show = (): void => setExpired(true);
    window.addEventListener(API_SESSION_EXPIRED, show);
    return () => window.removeEventListener(API_SESSION_EXPIRED, show);
  }, []);

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

  return (
    <Dialog.Root open={expired && !session} onOpenChange={setExpired}>
      <Dialog.Portal>
        <Dialog.Overlay className="session-expired__overlay" />
        <Dialog.Content className="session-expired__panel">
          <Dialog.Title>Phiên đăng nhập đã kết thúc</Dialog.Title>
          <Dialog.Description>
            Bạn đã được đăng xuất. Vui lòng đăng nhập lại để tiếp tục đặt vé
            hoặc truy cập tài khoản.
          </Dialog.Description>
          <Button
            onClick={() => {
              setExpired(false);
              if (window.location.pathname !== ROUTES.login)
                window.location.assign(ROUTES.login);
            }}
          >
            Đăng nhập lại
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
