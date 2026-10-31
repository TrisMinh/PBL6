import { isMockApi } from "@/shared/api/config";
import { clearApiSession } from "@/shared/api/session";
import type { AuthSession } from "@/features/auth/repositories/authRepository";
import { authenticatedSessionSchema } from "@/features/auth/schemas/session.schema";
import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";

function notify(): void {
  window.dispatchEvent(
    new StorageEvent("storage", { key: MOCK_SESSION_STORAGE_KEY }),
  );
}
export function writeMockSession(session: AuthSession): boolean {
  const parsed = authenticatedSessionSchema.safeParse(session);
  if (!parsed.success || Date.parse(parsed.data.expiresAt) <= Date.now())
    return false;
  try {
    window.sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify(parsed.data),
    );
    notify();
    return true;
  } catch {
    return false;
  }
}
export function clearMockSession(): void {
  if (!isMockApi) {
    clearApiSession();
    return;
  }
  try {
    const existed =
      window.sessionStorage.getItem(MOCK_SESSION_STORAGE_KEY) !== null;
    window.sessionStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
    if (existed) notify();
  } catch {
    /* Missing storage already fails closed. */
  }
}
