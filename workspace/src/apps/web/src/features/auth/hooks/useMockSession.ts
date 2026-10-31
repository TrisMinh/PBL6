import { isMockApi } from "@/shared/api/config";
import { readApiSession, toUiSession } from "@/shared/api/session";
import { useEffect, useState } from "react";

import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";
import { sessionTokenSchema } from "@/features/auth/schemas/session.schema";
import type { MockSession } from "@/features/auth/types/auth";
import { useSessionClock } from "@/shared/lib/useSessionClock";

export interface MockSessionState {
  session: MockSession | null;
  isHydrated: boolean;
}

function parseSession(value: unknown): MockSession | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("userId" in value) ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    !("role" in value) ||
    (value.role !== "admin" && value.role !== "customer") ||
    !("expiresAt" in value) ||
    typeof value.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    ("token" in value && !sessionTokenSchema.safeParse(value.token).success)
  )
    return null;

  const token =
    "token" in value ? sessionTokenSchema.safeParse(value.token) : null;
  return {
    userId: value.userId,
    role: value.role,
    expiresAt: value.expiresAt,
    ...(token?.success ? { token: token.data } : {}),
  };
}

function readSession(): MockSession | null {
  if (!isMockApi) {
    const session = readApiSession();
    return session ? toUiSession(session) : null;
  }
  try {
    const raw = window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return parseSession(value);
  } catch {
    // Unreadable or malformed local data is treated as an unauthenticated session.
    return null;
  }
}

export function useMockSession(): MockSessionState {
  const [state, setState] = useState<MockSessionState>({
    session: null,
    isHydrated: false,
  });
  const nowMs = useSessionClock(state.session?.expiresAt);

  useEffect(() => {
    const hydrate = (): void =>
      setState({ session: readSession(), isHydrated: true });
    const onStorage = (event: StorageEvent): void => {
      if (event.key === MOCK_SESSION_STORAGE_KEY || event.key === null)
        hydrate();
    };
    hydrate();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const session =
    state.session &&
    nowMs !== null &&
    (!isMockApi || Date.parse(state.session.expiresAt) > nowMs)
      ? state.session
      : null;
  return { session, isHydrated: state.isHydrated && nowMs !== null };
}
