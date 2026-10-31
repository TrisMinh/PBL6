import { useBookingDraftStore } from "@/features/booking/store/bookingDraftStore";
import { isMockApi } from "@/shared/api/config";
import { logoutApi, refreshAccessToken } from "@/shared/api/client";
import { readApiSession } from "@/shared/api/session";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

import { useMockSession } from "@/features/auth/hooks/useMockSession";
import { clearMockSession } from "@/features/auth/lib/sessionStorage";
import type { MockSessionState } from "@/features/auth/hooks/useMockSession";

export function useAccountSession(): MockSessionState & { revoke: () => void } {
  const state = useMockSession(),
    client = useQueryClient(),
    previous = useRef<string | undefined>(undefined);
  const revoke = useCallback(() => {
    if (!isMockApi) void logoutApi().catch(() => undefined);
    else clearMockSession();
    if (!isMockApi) {
      void client.cancelQueries();
      client.clear();
      useBookingDraftStore.getState().clearDraft();
    }
    client.removeQueries({ queryKey: ["account-tickets"] });
    client.removeQueries({ queryKey: ["account-ticket-detail"] });
  }, [client]);
  useEffect(() => {
    if (!state.isHydrated) return;
    if (previous.current !== state.session?.token) {
      client.removeQueries({ queryKey: ["account-tickets"], type: "inactive" });
      client.removeQueries({
        queryKey: ["account-ticket-detail"],
        type: "inactive",
      });
    }
    if (!state.session) {
      if (isMockApi) revoke();
      else if (previous.current) {
        void client.cancelQueries({ queryKey: ["live-api"] });
        client.removeQueries({ queryKey: ["live-api"] });
        useBookingDraftStore.getState().clearDraft();
      }
    }
    previous.current = state.session?.token;
  }, [state.isHydrated, state.session?.token, state.session, revoke, client]);
  useEffect(() => {
    if (isMockApi) return;
    const session = readApiSession();
    if (!session) return;
    const timer = window.setTimeout(
      () => {
        void refreshAccessToken().catch(() => undefined);
      },
      Math.max(1000, session.expiresAt - Date.now() - 60_000),
    );
    return () => window.clearTimeout(timer);
  }, [state.session?.token]);
  return { ...state, revoke };
}
