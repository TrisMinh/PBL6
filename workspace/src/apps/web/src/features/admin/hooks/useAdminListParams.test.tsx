import { act, render, screen, waitFor } from "@testing-library/react";
import { type ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { useAdminListParams } from "@/features/admin/hooks/useAdminListParams";

function ParamsProbe(): ReactElement {
  const location = useLocation();
  const { params, updateParams } = useAdminListParams();
  return (
    <>
      <output aria-label="Tham số đã parse">{JSON.stringify(params)}</output>
      <output aria-label="Query hiện tại">{location.search}</output>
      <button onClick={() => updateParams({ status: "active" })} type="button">
        Lọc hoạt động
      </button>
      <button onClick={() => updateParams({ page: 4 })} type="button">
        Trang 4
      </button>
      <button
        onClick={() =>
          updateParams({
            organizationId: undefined,
            page: 1,
            query: undefined,
            status: undefined,
          })
        }
        type="button"
      >
        Xóa bộ lọc
      </button>
    </>
  );
}

function renderProbe(initialEntry: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ParamsProbe />
    </MemoryRouter>,
  );
}

describe("useAdminListParams", () => {
  it("useAdminListParams normalizes invalid list values once and preserves unrelated params", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderProbe(
      "/admin/organizations?page=-2&status=private&query=%20Blue%20&dialog=edit",
    );

    expect(
      JSON.parse(screen.getByLabelText("Tham số đã parse").textContent ?? ""),
    ).toEqual({ page: 1, pageSize: 20, query: "Blue" });
    await waitFor(() => {
      const current = new URLSearchParams(
        screen.getByLabelText("Query hiện tại").textContent ?? "",
      );
      expect(Object.fromEntries(current)).toEqual({
        dialog: "edit",
        query: "Blue",
      });
    });
    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining("Maximum update depth"),
    );
    warn.mockRestore();
  });

  it("useAdminListParams resets page for filters and keeps filters for pagination", async () => {
    renderProbe(
      "/admin/organizations?query=coach&page=3&pageSize=50&dialog=create",
    );

    act(() => screen.getByRole("button", { name: "Lọc hoạt động" }).click());
    await waitFor(() => {
      const current = new URLSearchParams(
        screen.getByLabelText("Query hiện tại").textContent ?? "",
      );
      expect(current.get("page")).toBeNull();
      expect(current.get("pageSize")).toBe("50");
      expect(current.get("query")).toBe("coach");
      expect(current.get("status")).toBe("active");
      expect(current.get("dialog")).toBe("create");
    });

    act(() => screen.getByRole("button", { name: "Trang 4" }).click());
    await waitFor(() => {
      const current = new URLSearchParams(
        screen.getByLabelText("Query hiện tại").textContent ?? "",
      );
      expect(current.get("page")).toBe("4");
      expect(current.get("query")).toBe("coach");
      expect(current.get("status")).toBe("active");
      expect(current.get("dialog")).toBe("create");
    });
  });

  it("useAdminListParams clears only filters and page while retaining page size and dialog", async () => {
    renderProbe(
      "/admin/staff?query=blue&organizationId=org-blue&status=active&page=2&pageSize=40&dialog=edit",
    );

    act(() => screen.getByRole("button", { name: "Xóa bộ lọc" }).click());
    await waitFor(() => {
      const current = new URLSearchParams(
        screen.getByLabelText("Query hiện tại").textContent ?? "",
      );
      expect(Object.fromEntries(current)).toEqual({
        dialog: "edit",
        pageSize: "40",
      });
    });
  });
});
