import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";

import { AdminFilters } from "@/features/admin/components/AdminFilters/AdminFilters";
import { useAdminListParams } from "@/features/admin/hooks/useAdminListParams";

const ORGANIZATIONS = [
  { value: "org-blue-demo", label: "BLUE Demo Transit" },
  { value: "org-river-demo", label: "River Demo Coach" },
] as const;
const STATUSES = [
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Tạm dừng" },
] as const;

function FiltersHarness(): ReactElement {
  const location = useLocation();
  const { params, updateParams } = useAdminListParams();
  return (
    <>
      <AdminFilters
        organizationOptions={ORGANIZATIONS}
        params={params}
        statusOptions={STATUSES}
        totalPages={5}
        updateParams={updateParams}
      />
      <output aria-label="Query hiện tại">{location.search}</output>
    </>
  );
}

function renderFilters(initialEntry: string): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <FiltersHarness />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AdminFilters", () => {
  it("AdminFilters debounces query for 300ms and resets the page", async () => {
    vi.useFakeTimers();
    renderFilters("/admin/organizations?query=old&page=4&dialog=create");

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm kiếm" }), {
      target: { value: "new coach" },
    });
    act(() => vi.advanceTimersByTime(299));
    const beforeDebounce = new URLSearchParams(
      screen.getByLabelText("Query hiện tại").textContent ?? "",
    );
    expect(Object.fromEntries(beforeDebounce)).toEqual({
      dialog: "create",
      page: "4",
      query: "old",
    });
    await act(async () => vi.advanceTimersByTimeAsync(1));

    const current = new URLSearchParams(
      screen.getByLabelText("Query hiện tại").textContent ?? "",
    );
    expect(current.get("query")).toBe("new coach");
    expect(current.get("page")).toBeNull();
    expect(current.get("dialog")).toBe("create");
  });

  it("AdminFilters applies organization and status immediately with page reset", async () => {
    renderFilters("/admin/staff?page=3&pageSize=50&dialog=edit");

    fireEvent.change(screen.getByLabelText("Tổ chức"), {
      target: { value: "org-blue-demo" },
    });
    fireEvent.change(screen.getByLabelText("Trạng thái"), {
      target: { value: "active" },
    });

    await waitFor(() => {
      const current = new URLSearchParams(
        screen.getByLabelText("Query hiện tại").textContent ?? "",
      );
      expect(current.get("organizationId")).toBe("org-blue-demo");
      expect(current.get("status")).toBe("active");
      expect(current.get("page")).toBeNull();
      expect(current.get("pageSize")).toBe("50");
      expect(current.get("dialog")).toBe("edit");
    });
  });

  it("AdminFilters clear removes filter keys and keeps unrelated params", async () => {
    renderFilters(
      "/admin/staff?query=blue&organizationId=org-blue-demo&status=active&page=4&pageSize=40&dialog=edit",
    );

    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));

    await waitFor(() => {
      const current = new URLSearchParams(
        screen.getByLabelText("Query hiện tại").textContent ?? "",
      );
      expect(Object.fromEntries(current)).toEqual({
        dialog: "edit",
        pageSize: "40",
      });
    });
    expect(screen.getByRole("searchbox", { name: "Tìm kiếm" })).toHaveValue("");
  });

  it("AdminFilters clear cancels a pending debounced query", async () => {
    vi.useFakeTimers();
    renderFilters("/admin/staff?dialog=create");

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm kiếm" }), {
      target: { value: "pending query" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xóa bộ lọc" }));
    await act(async () => vi.advanceTimersByTimeAsync(300));

    const current = new URLSearchParams(
      screen.getByLabelText("Query hiện tại").textContent ?? "",
    );
    expect(current.get("query")).toBeNull();
    expect(current.get("dialog")).toBe("create");
    expect(screen.getByRole("searchbox", { name: "Tìm kiếm" })).toHaveValue("");
  });

  it("AdminFilters pagination retains filters and disables boundary actions", async () => {
    renderFilters(
      "/admin/bookings?query=blue&organizationId=org-blue-demo&status=active&page=2&dialog=create",
    );

    expect(screen.getByText("Trang 2 / 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Trang tiếp theo" }));

    await waitFor(() => {
      const current = new URLSearchParams(
        screen.getByLabelText("Query hiện tại").textContent ?? "",
      );
      expect(current.get("page")).toBe("3");
      expect(current.get("query")).toBe("blue");
      expect(current.get("organizationId")).toBe("org-blue-demo");
      expect(current.get("status")).toBe("active");
      expect(current.get("dialog")).toBe("create");
    });

    fireEvent.click(screen.getByRole("button", { name: "Trang cuối" }));
    await waitFor(() =>
      expect(screen.getByText("Trang 5 / 5")).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Trang tiếp theo" }),
    ).toBeDisabled();
  });
});
