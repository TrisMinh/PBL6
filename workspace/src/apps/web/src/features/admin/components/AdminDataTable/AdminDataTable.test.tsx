import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, type ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";

import {
  AdminDataTable,
  type AdminDataColumn,
} from "@/features/admin/components/AdminDataTable/AdminDataTable";
import { AdminListState } from "@/features/admin/components/AdminDataTable/AdminListState";

interface Row {
  id: string;
  name: string;
  status: string;
}

const ROWS: readonly Row[] = [
  { id: "org-blue-demo", name: "BLUE Demo Transit", status: "Hoạt động" },
  { id: "org-river-demo", name: "River Demo Coach", status: "Tạm dừng" },
];
const COLUMNS: readonly AdminDataColumn<Row>[] = [
  { key: "name", header: "Tên tổ chức", render: (row) => row.name },
  { key: "status", header: "Trạng thái", render: (row) => row.status },
];

function LocationProbe(): ReactElement {
  return (
    <output aria-label="Đường dẫn hiện tại">{useLocation().pathname}</output>
  );
}

function renderTable(
  overrides: Partial<ComponentProps<typeof AdminDataTable<Row>>> = {},
): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={["/admin/organizations"]}>
      <AdminDataTable
        caption="Danh sách tổ chức"
        columns={COLUMNS}
        getRowHref={(row) => `/admin/organizations/${row.id}`}
        getRowKey={(row) => row.id}
        items={ROWS}
        {...overrides}
      />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("AdminDataTable", () => {
  it("AdminDataTable renders a semantic caption, headers and row links", () => {
    renderTable();

    const table = screen.getByRole("table", { name: "Danh sách tổ chức" });
    expect(within(table).getByText("Danh sách tổ chức")).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Tên tổ chức" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Trạng thái" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "BLUE Demo Transit" }),
    ).toHaveAttribute("href", "/admin/organizations/org-blue-demo");
  });

  it("AdminDataTable renders visible mobile labels for every data cell", () => {
    const view = renderTable();
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);

    for (const row of rows) {
      const labels = Array.from(
        row.querySelectorAll(".admin-data-table__mobile-label"),
      ).map((label) => label.textContent);
      expect(labels).toEqual(["Tên tổ chức", "Trạng thái"]);
    }
    expect(view.container.querySelector(".admin-data-table__viewport")).toBe(
      null,
    );
  });

  it("AdminDataTable keeps stable row nodes when items reorder", () => {
    const view = renderTable();
    const firstNode = screen.getByText("BLUE Demo Transit").closest("tr");

    view.rerender(
      <MemoryRouter initialEntries={["/admin/organizations"]}>
        <AdminDataTable
          caption="Danh sách tổ chức"
          columns={COLUMNS}
          getRowHref={(row) => `/admin/organizations/${row.id}`}
          getRowKey={(row) => row.id}
          items={[...ROWS].reverse()}
        />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(screen.getByText("BLUE Demo Transit").closest("tr")).toBe(firstNode);
  });

  it("AdminDataTable runs a keyboard action without navigating the row link", async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(row: Row) => void>();
    renderTable({
      actions: [
        {
          key: "edit",
          label: (row) => `Chỉnh sửa ${row.name}`,
          onSelect: onEdit,
        },
      ],
      actionsHeader: "Thao tác",
    });
    const action = screen.getByRole("button", {
      name: "Chỉnh sửa BLUE Demo Transit",
    });

    action.focus();
    await user.keyboard("{Enter}");

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(ROWS[0]);
    expect(screen.getByLabelText("Đường dẫn hiện tại")).toHaveTextContent(
      "/admin/organizations",
    );
    expect(action.closest("a")).toBeNull();
    expect(action).toHaveClass("button");
  });
});

describe("AdminListState", () => {
  it("AdminListState marks loading presentation busy", () => {
    render(
      <AdminListState label="Đang tải danh sách tổ chức" state="loading" />,
    );

    const status = screen.getByRole("status", {
      name: "Đang tải danh sách tổ chức",
    });
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Đang tải dữ liệu");
  });

  it("AdminListState renders empty content through PageState", () => {
    render(
      <AdminListState
        description="Chưa có tổ chức phù hợp với bộ lọc."
        state="empty"
        title="Không có tổ chức"
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Không có tổ chức" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/phù hợp với bộ lọc/)).toBeInTheDocument();
  });

  it("AdminListState renders a real retry button for errors", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <AdminListState
        description="Không thể tải danh sách lúc này."
        onRetry={onRetry}
        state="error"
        title="Có lỗi xảy ra"
      />,
    );

    const retry = screen.getByRole("button", { name: "Thử lại" });
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
