import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router";
import { ResourcePicker, type ResourceOption } from "./ResourcePicker";
const options: ResourceOption[] = [
  {
    id: "busy",
    label: "43B-071.26",
    description: "Giường nằm · 34 chỗ",
    disabled: true,
    conflicts: [
      {
        id: "trip",
        busId: "busy",
        driverId: "driver",
        departureAt: "2027-03-24T01:00:00Z",
        arrivalAt: "2027-03-24T04:00:00Z",
        status: "SCHEDULED",
        origin: "Đà Nẵng",
        destination: "Huế",
      },
    ],
  },
  {
    id: "free",
    label: "43B-068.79",
    description: "Giường nằm · 34 chỗ",
    disabled: false,
    conflicts: [],
  },
];
beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
function show(
  onChange = (id: string): void => {
    void id;
  },
): void {
  render(
    <MemoryRouter>
      <ResourcePicker
        label="Xe"
        placeholder="Chọn phương tiện"
        value=""
        options={options}
        disabled={false}
        onChange={onChange}
      />
    </MemoryRouter>,
  );
}
describe("searchable resource assignment", () => {
  it("has no explanatory notes or upward-opening popup", () => {
    show();
    fireEvent.click(screen.getByRole("combobox", { name: "Xe" }));
    expect(
      document.querySelector(".resource-picker__popup.is-above"),
    ).toBeNull();
    expect(document.querySelector(".resource-picker__footnote")).toBeNull();
    expect(document.querySelector(".resource-picker__count")).toBeNull();
    expect(screen.getByText("Đà Nẵng → Huế")).toBeVisible();
  });
  it("shows available resources first and explains busy routes without permitting selection", () => {
    const change = vi.fn();
    show(change);
    fireEvent.click(screen.getByRole("combobox", { name: "Xe" }));
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("43B-068.79");
    const busy = screen.getAllByRole("option")[1];
    expect(busy).toHaveAttribute("aria-disabled", "true");
    expect(busy).toHaveTextContent("Đà Nẵng → Huế");
    expect(busy).toHaveTextContent("08:00");
    fireEvent.click(busy);
    expect(change).not.toHaveBeenCalled();
    expect(
      screen.queryByText("Xem chuyến đang phân công"),
    ).not.toBeInTheDocument();
  });
  it("searches plate numbers without punctuation and Vietnamese routes without accents", () => {
    show();
    fireEvent.click(screen.getByRole("combobox", { name: "Xe" }));
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "43b06879" },
    });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("43B-068.79");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "da nang" },
    });
    expect(screen.getByRole("option")).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "khong co" },
    });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Không tìm thấy lựa chọn phù hợp.")).toBeVisible();
  });
  it("chooses by keyboard and closes with Escape", () => {
    const change = vi.fn();
    show(change);
    fireEvent.click(screen.getByRole("combobox", { name: "Xe" }));
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Enter" });
    expect(change).toHaveBeenCalledWith("free");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("combobox", { name: "Xe" }));
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(screen.getByRole("combobox")).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
