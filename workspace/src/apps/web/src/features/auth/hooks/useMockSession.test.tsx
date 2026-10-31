import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MOCK_SESSION_STORAGE_KEY } from "@/features/auth/config/session";
import { useMockSession } from "@/features/auth/hooks/useMockSession";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  sessionStorage.clear();
});

function SessionProbe(): React.ReactElement {
  const { session, isHydrated } = useMockSession();
  return <p>{isHydrated ? (session?.role ?? "guest") : "loading"}</p>;
}

describe("useMockSession", () => {
  it("useMockSession hydrates a valid admin session", () => {
    const session = {
      userId: "admin-test",
      role: "admin",
      expiresAt: "2099-01-01T00:00:00.000Z",
    };
    sessionStorage.setItem(MOCK_SESSION_STORAGE_KEY, JSON.stringify(session));
    const { result } = renderHook(() => useMockSession());

    expect(result.current).toEqual({ session, isHydrated: true });
  });

  it("useMockSession does not read storage during initial server render", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    expect(renderToString(<SessionProbe />)).toContain("loading");
    expect(read).not.toHaveBeenCalled();
  });

  it.each([
    "{bad json",
    "null",
    "[]",
    "123",
    '"session"',
    JSON.stringify({
      userId: "a",
      role: "owner",
      expiresAt: "2099-01-01T00:00:00Z",
    }),
    JSON.stringify({
      userId: " ",
      role: "admin",
      expiresAt: "2099-01-01T00:00:00Z",
    }),
    JSON.stringify({ userId: "a", role: "admin", expiresAt: "not-a-date" }),
    JSON.stringify({ userId: "a", role: "admin" }),
    JSON.stringify({
      userId: 7,
      role: "admin",
      expiresAt: "2099-01-01T00:00:00Z",
    }),
    JSON.stringify({ userId: "a", expiresAt: "2099-01-01T00:00:00Z" }),
    JSON.stringify({ userId: "a", role: "admin", expiresAt: 7 }),
  ])("useMockSession rejects malformed local session %s", (raw) => {
    sessionStorage.setItem(MOCK_SESSION_STORAGE_KEY, raw);
    const { result } = renderHook(() => useMockSession());
    expect(result.current).toEqual({ session: null, isHydrated: true });
  });

  it("useMockSession fails closed when storage access is denied", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    const { result } = renderHook(() => useMockSession());
    expect(result.current).toEqual({ session: null, isHydrated: true });
  });

  it("useMockSession rejects an already expired session", () => {
    sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: "a",
        role: "admin",
        expiresAt: "2000-01-01T00:00:00Z",
      }),
    );
    const { result } = renderHook(() => useMockSession());
    expect(result.current).toEqual({ session: null, isHydrated: true });
  });

  it("useMockSession expires after mount and cleans its timer on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
    sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: "a",
        role: "admin",
        expiresAt: "2026-10-19T00:00:01Z",
      }),
    );
    const { result, unmount } = renderHook(() => useMockSession());
    expect(result.current.session?.role).toBe("admin");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.session).toBeNull();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("useMockSession removes a pending expiry timer when unmounted early", () => {
    vi.useFakeTimers();
    sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: "a",
        role: "customer",
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
    const { unmount } = renderHook(() => useMockSession());
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("useMockSession revalidates on focus after the clock has advanced", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T00:00:00Z"));
    sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: "a",
        role: "admin",
        expiresAt: "2026-10-19T00:00:01Z",
      }),
    );
    const { result } = renderHook(() => useMockSession());
    act(() => {
      vi.setSystemTime(new Date("2026-10-19T00:00:02Z"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(result.current.session).toBeNull();
  });

  it("useMockSession refreshes only for its storage key or a clear event", () => {
    sessionStorage.setItem(
      MOCK_SESSION_STORAGE_KEY,
      JSON.stringify({
        userId: "a",
        role: "admin",
        expiresAt: "2099-01-01T00:00:00Z",
      }),
    );
    const { result } = renderHook(() => useMockSession());
    sessionStorage.removeItem(MOCK_SESSION_STORAGE_KEY);
    act(() =>
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated" })),
    );
    expect(result.current.session?.role).toBe("admin");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: MOCK_SESSION_STORAGE_KEY }),
      ),
    );
    expect(result.current.session).toBeNull();
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: null })));
    expect(result.current.isHydrated).toBe(true);
  });
});
