import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  TICKET_ACCESS_STORAGE_KEY,
  TICKET_DETAIL_QUERY_KEY,
} from "@/features/tickets/config/access";
import { useTicketAccess } from "@/features/tickets/hooks/useTicketAccess";
import { createTicketAccessStorage } from "@/features/tickets/lib/ticketAccessStorage";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
function wrapper(
  client: QueryClient,
): (props: PropsWithChildren) => ReactElement {
  return ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}
function access(): { token: string; ticketCodes: string[]; expiresAt: string } {
  return {
    token: "t".repeat(40),
    ticketCodes: ["BLUE-ABC"],
    expiresAt: new Date(Date.now() + 900000).toISOString(),
  };
}
describe("ticket access hydration and expiry", () => {
  it("automatically revokes on the original deadline without user focus", () => {
    vi.useFakeTimers();
    const value = access();
    sessionStorage.setItem(TICKET_ACCESS_STORAGE_KEY, JSON.stringify(value));
    const client = new QueryClient(),
      { result } = renderHook(() => useTicketAccess(), {
        wrapper: wrapper(client),
      });
    expect(result.current.access).toEqual(value);
    client.setQueryData([TICKET_DETAIL_QUERY_KEY, "BLUE-ABC"], {
      passenger: "PRIVATE_TEST",
    });
    act(() => vi.advanceTimersByTime(900000));
    expect(result.current.access).toBeNull();
    expect(sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY)).toBeNull();
    expect(
      client.getQueriesData({ queryKey: [TICKET_DETAIL_QUERY_KEY] }),
    ).toEqual([]);
  });
  it("never reads storage during SSR/initial render", () => {
    const read = vi.spyOn(Storage.prototype, "getItem");
    function Probe(): ReactElement {
      const state = useTicketAccess();
      return <p>{state.isHydrated ? "ready" : "checking"}</p>;
    }
    const client = new QueryClient();
    expect(
      renderToString(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      ),
    ).toContain("checking");
    expect(read).not.toHaveBeenCalled();
  });
  it("hydrates only validated unexpired access and revokes token and all detail cache at expiry", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const value = access();
    sessionStorage.setItem(TICKET_ACCESS_STORAGE_KEY, JSON.stringify(value));
    const client = new QueryClient();
    client.setQueryData([TICKET_DETAIL_QUERY_KEY, "BLUE-ABC"], {
      passenger: "PRIVATE_TEST",
    });
    const { result } = renderHook(() => useTicketAccess(), {
      wrapper: wrapper(client),
    });
    await waitFor(() => expect(result.current.isHydrated).toBe(true));
    expect(result.current.access).toEqual(value);
    client.setQueryData([TICKET_DETAIL_QUERY_KEY, "BLUE-ABC"], {
      passenger: "PRIVATE_TEST",
    });
    vi.setSystemTime(Date.parse(value.expiresAt));
    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.access).toBeNull());
    expect(sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY)).toBeNull();
    expect(
      client.getQueriesData({ queryKey: [TICKET_DETAIL_QUERY_KEY] }),
    ).toEqual([]);
  });
  it.each(["json", "extra", "past", "future"])(
    "fails closed and removes malformed %s storage",
    async (kind) => {
      const value = access();
      if (kind === "past")
        value.expiresAt = new Date(Date.now() - 1).toISOString();
      if (kind === "future")
        value.expiresAt = new Date(Date.now() + 9000100).toISOString();
      sessionStorage.setItem(
        TICKET_ACCESS_STORAGE_KEY,
        kind === "json"
          ? "bad-json"
          : JSON.stringify(
              kind === "extra"
                ? { ...value, verificationValue: "PRIVATE_TEST" }
                : value,
            ),
      );
      const { result } = renderHook(() => useTicketAccess(), {
        wrapper: wrapper(new QueryClient()),
      });
      await waitFor(() => expect(result.current.isHydrated).toBe(true));
      expect(result.current.access).toBeNull();
      expect(sessionStorage.getItem(TICKET_ACCESS_STORAGE_KEY)).toBeNull();
    },
  );
  it("responds to storage revocation and cleans subscriptions on unmount", async () => {
    sessionStorage.setItem(TICKET_ACCESS_STORAGE_KEY, JSON.stringify(access()));
    const remove = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useTicketAccess(), {
      wrapper: wrapper(new QueryClient()),
    });
    await waitFor(() => expect(result.current.access).not.toBeNull());
    sessionStorage.removeItem(TICKET_ACCESS_STORAGE_KEY);
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", { key: TICKET_ACCESS_STORAGE_KEY }),
      ),
    );
    await waitFor(() => expect(result.current.access).toBeNull());
    unmount();
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function));
  });
  it("storage factory stays lazy and refuses denied storage without logging or throwing", () => {
    const resolve = vi.fn(() => {
      throw new Error("denied");
    });
    const storage = createTicketAccessStorage(resolve);
    expect(resolve).not.toHaveBeenCalled();
    expect(storage.read()).toBeNull();
    expect(storage.write(access())).toBe(false);
    expect(() => storage.clear()).not.toThrow();
  });
});
