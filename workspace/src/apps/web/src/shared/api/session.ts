import { z } from "zod";

const KEY = "blue-api-session";
const REFRESH_KEY = "blue-api-refresh-attempt";
const UI_KEY = "blue-mock-session"; // Existing UI subscribers; no mock credentials in live mode.
export const backendSessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int().positive(),
  sessionId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    roles: z.array(z.string()),
    organizationMemberships: z
      .array(z.object({ status: z.string(), roleCodes: z.array(z.string()) }))
      .optional(),
  }),
});
export type BackendSession = z.infer<typeof backendSessionSchema>;
const storedSchema = backendSessionSchema.extend({ expiresAt: z.number() });
export type StoredSession = z.infer<typeof storedSchema>;

export function readApiSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const result = storedSchema.safeParse(
      JSON.parse(window.sessionStorage.getItem(KEY) ?? "null"),
    );
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function toUiSession(session: StoredSession): {
  userId: string;
  role: "admin" | "customer";
  expiresAt: string;
  token: string;
} {
  return {
    userId: session.user.id,
    role: session.user.roles.includes("PLATFORM_ADMIN")
      ? ("admin" as const)
      : ("customer" as const),
    expiresAt: new Date(session.expiresAt).toISOString(),
    token: session.accessToken,
  };
}
export function saveApiSession(input: BackendSession): StoredSession {
  const session = {
    ...backendSessionSchema.parse(input),
    expiresAt: Date.now() + input.expiresIn * 1000,
  };
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
    window.sessionStorage.removeItem(REFRESH_KEY);
    window.sessionStorage.setItem(UI_KEY, JSON.stringify(toUiSession(session)));
    window.dispatchEvent(new StorageEvent("storage", { key: UI_KEY }));
  }
  return session;
}
/** Persist until rotation succeeds so a lost response can be replayed safely. */
export function refreshAttemptKey(sessionId: string): string {
  const raw = sessionStorage.getItem(REFRESH_KEY);
  const parsed = z
    .object({ sessionId: z.string(), key: z.string().uuid() })
    .safeParse(raw ? JSON.parse(raw) : null);
  if (parsed.success && parsed.data.sessionId === sessionId)
    return parsed.data.key;
  const key = crypto.randomUUID();
  sessionStorage.setItem(REFRESH_KEY, JSON.stringify({ sessionId, key }));
  return key;
}
export function clearApiSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
  window.sessionStorage.removeItem(REFRESH_KEY);
  window.sessionStorage.removeItem(UI_KEY);
  window.sessionStorage.removeItem("blue-booking-draft");
  for (const key of Object.keys(window.sessionStorage)) {
    if (
      key.startsWith("blue-live-booking:") ||
      key.startsWith("blue-live-request:") ||
      key.startsWith("blue-live-operator-")
    )
      window.sessionStorage.removeItem(key);
  }
  window.dispatchEvent(new StorageEvent("storage", { key: UI_KEY }));
}
