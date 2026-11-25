import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { afterEach, expect, it, vi } from "vitest";

import { SessionLifecycle } from "./SessionLifecycle";
import { refreshAccessToken } from "@/shared/api/client";
import { readApiSession, saveApiSession } from "@/shared/api/session";

vi.hoisted(() => vi.resetModules());
vi.mock("@/shared/api/config", () => ({ isMockApi: false, apiBaseUrl: "" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

it("replaces the current page with login when the server rejects renewal", async () => {
  saveApiSession({
    accessToken: "test-access",
    refreshToken: "test-refresh",
    tokenType: "Bearer",
    expiresIn: 900,
    sessionId: "019a3a71-0000-7000-8000-000000000001",
    user: { id: "019a3a71-0000-7000-8000-000000000002", roles: ["CUSTOMER"] },
  });
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce(new Response(null, { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <SessionLifecycle />
            <Outlet />
          </>
        ),
        children: [
          { path: "/trips", element: <h1>Tìm chuyến</h1> },
          { path: "/login", element: <h1>Đăng nhập</h1> },
        ],
      },
    ],
    { initialEntries: ["/trips"] },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );

  await expect(refreshAccessToken()).rejects.toMatchObject({
    code: "NETWORK_ERROR",
  });
  expect(readApiSession()).not.toBeNull();
  expect(router.state.location.pathname).toBe("/trips");

  await act(async () => {
    await expect(refreshAccessToken()).rejects.toMatchObject({ status: 401 });
  });
  expect(readApiSession()).toBeNull();
  expect(router.state.historyAction).toBe("REPLACE");
  expect(
    await screen.findByRole("heading", { name: "Đăng nhập" }),
  ).toBeVisible();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Phiên đăng nhập đã kết thúc",
  );
});
