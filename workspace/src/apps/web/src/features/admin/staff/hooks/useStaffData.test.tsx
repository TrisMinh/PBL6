import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren, ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MockSessionState } from "@/features/auth/hooks/useMockSession";
import {
  useStaff,
  useStaffMember,
  useStaffOrganizations,
} from "./useStaffData";

const mocks = vi.hoisted(() => ({
  session: { session: null, isHydrated: false } as MockSessionState,
  repository: {
    listStaff: vi.fn(),
    getStaff: vi.fn(),
    listOrganizations: vi.fn(),
  },
}));

vi.mock("@/features/auth/hooks/useMockSession", () => ({
  useMockSession: () => mocks.session,
}));
vi.mock("@/features/admin/repositories/httpAdminRepository", () => ({
  createHttpAdminRepository: () => mocks.repository,
}));

describe("staff queries during session restoration", () => {
  beforeEach(() => {
    mocks.session = { session: null, isHydrated: false };
    const list = { items: [], page: 1, pageSize: 20, total: 0 };
    mocks.repository.listStaff.mockReset().mockResolvedValue(list);
    mocks.repository.listOrganizations.mockReset().mockResolvedValue(list);
    mocks.repository.getStaff.mockReset().mockResolvedValue({ id: "USR-0018" });
  });

  it.each([
    {
      name: "staff list",
      useData: () => useStaff({ page: 1, pageSize: 20 }),
      request: mocks.repository.listStaff,
    },
    {
      name: "staff detail",
      useData: () => useStaffMember("USR-0018"),
      request: mocks.repository.getStaff,
    },
    {
      name: "organization choices",
      useData: () => useStaffOrganizations(),
      request: mocks.repository.listOrganizations,
    },
  ])("waits for the session before loading $name", async (sample) => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    function Wrapper({ children }: PropsWithChildren): ReactElement {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }
    const { result, rerender, unmount } = renderHook(() => sample.useData(), {
      wrapper: Wrapper,
    });
    try {
      await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
      expect(result.current.isError).toBe(false);
      expect(sample.request).not.toHaveBeenCalled();

      mocks.session = {
        isHydrated: true,
        session: {
          userId: "mock-admin",
          role: "admin",
          token: "00000000-0000-4000-8000-000000000020",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      };
      rerender();
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(sample.request).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
      client.clear();
    }
  });
});
