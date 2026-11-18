import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SearchableFilterSelect } from "./SearchableFilterSelect";

const options = [
  { value: "hv", label: "Hải Vân Travel", searchText: "HAI-VAN-TRAVEL" },
  { value: "dn", label: "Đà Nẵng Express" },
  ...Array.from({ length: 7 }, (_, index) => ({
    value: `org-${index}`,
    label: `Nhà xe ${index}`,
  })),
];
function Harness({
  onChange = vi.fn(),
}: {
  onChange?: (value: string) => void;
}): ReactElement {
  const [value, setValue] = useState("");
  return (
    <SearchableFilterSelect
      label="Nhà xe"
      allLabel="Tất cả nhà xe"
      options={options}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}
describe("searchable admin filters", () => {
  it("keeps a short dropdown native", async () => {
    const change = vi.fn();
    render(
      <SearchableFilterSelect
        label="Trạng thái"
        allLabel="Tất cả"
        value=""
        options={options.slice(0, 2)}
        onChange={change}
      />,
    );
    await userEvent.setup().selectOptions(screen.getByRole("combobox"), "hv");
    expect(change).toHaveBeenCalledWith("hv");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("searches Vietnamese names without accents and commits only on selection", async () => {
    const user = userEvent.setup(),
      change = vi.fn();
    render(<Harness onChange={change} />);
    const trigger = screen.getByRole("combobox", { name: "Nhà xe" });
    await user.click(trigger);
    const search = screen.getByRole("textbox", { name: "Tìm nhà xe" });
    expect(search).toHaveFocus();
    await user.type(search, "hai van");
    expect(change).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("option", { name: "Đà Nẵng Express" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: /Hải Vân Travel/ }));
    expect(change).toHaveBeenCalledWith("hv");
    expect(trigger).toHaveTextContent("Hải Vân Travel");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(trigger);
    expect(screen.getByRole("textbox")).toHaveValue("");
    await user.type(screen.getByRole("textbox"), "da nang");
    expect(
      screen.getByRole("option", { name: "Đà Nẵng Express" }),
    ).toBeVisible();
  });
  it("supports keyboard selection and Escape without changing the value", async () => {
    const user = userEvent.setup(),
      change = vi.fn();
    render(<Harness onChange={change} />);
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    await user.type(screen.getByRole("textbox"), "hai van");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(change).toHaveBeenCalledWith("hv");
    await user.click(trigger);
    await user.type(screen.getByRole("textbox"), "no match");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveTextContent("Hải Vân Travel");
    expect(change).toHaveBeenCalledTimes(1);
    expect(trigger).toHaveFocus();
  });
  it("shows no results, allows clearing the selection, and closes outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Harness />
        <button>Outside</button>
      </>,
    );
    const trigger = screen.getByRole("combobox");
    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Hải Vân Travel" }));
    await user.click(trigger);
    await user.type(screen.getByRole("textbox"), "zzz");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Không tìm thấy kết quả",
    );
    await user.click(screen.getByRole("option", { name: /Tất cả nhà xe/ }));
    expect(trigger).toHaveTextContent("Tất cả nhà xe");
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
  it("cannot open when disabled", async () => {
    render(
      <SearchableFilterSelect
        label="Nhà xe"
        allLabel="Tất cả"
        value=""
        options={options}
        disabled
        onChange={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole("combobox"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
