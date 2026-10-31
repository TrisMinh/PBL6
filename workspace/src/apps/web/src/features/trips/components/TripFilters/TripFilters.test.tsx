import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TripFilters } from "@/features/trips/components/TripFilters/TripFilters";

const core =
  "originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2";
const desktopQuery = {
  matches: false,
  addEventListener: vi.fn<(type: string, listener: () => void) => void>(),
  removeEventListener: vi.fn(),
};

beforeEach(() => {
  desktopQuery.matches = false;
  desktopQuery.addEventListener.mockClear();
  desktopQuery.removeEventListener.mockClear();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue(desktopQuery));
});
afterEach(() => vi.unstubAllGlobals());

function FilterHarness({ initial = core }: { initial?: string }): ReactElement {
  const [params, setParams] = useState(new URLSearchParams(initial));
  return (
    <>
      <TripFilters searchParams={params} onChange={setParams} />
      <output aria-label="Query">{params.toString()}</output>
    </>
  );
}

function panel(): HTMLElement {
  return screen.getByRole("region", { name: "Bộ lọc chuyến" });
}

describe("TripFilters", () => {
  it("renders every canonical desktop filter group and action from Results node 215:105", () => {
    render(<FilterHarness />);
    const region = panel();
    for (const name of [
      "Loại xe",
      "Buổi khởi hành",
      "Giờ khởi hành",
      "Khoảng giá",
      "Tiện ích",
    ]) {
      expect(within(region).getByRole("group", { name })).toBeVisible();
    }
    for (const label of ["Có Wi-Fi", "Cổng sạc", "Nhà vệ sinh", "Đón tận nơi"])
      expect(
        within(region).getByRole("checkbox", { name: label }),
      ).toBeVisible();
    expect(
      within(region).getByRole("button", { name: "Áp dụng bộ lọc" }),
    ).toBeVisible();
  });

  it("labels native sort/vehicle selects with canonical options and defaults without emitting changes", () => {
    const onChange = vi.fn();
    render(
      <TripFilters
        searchParams={new URLSearchParams(core)}
        onChange={onChange}
      />,
    );
    const sort = within(panel()).getByRole("combobox", { name: "Sắp xếp" });
    expect(sort).toHaveValue("relevance");
    expect(
      within(sort)
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["relevance", "price-asc", "price-desc", "departure"]);
    const vehicle = within(panel()).getByRole("combobox", { name: "Loại xe" });
    expect(vehicle).toHaveValue("");
    expect(
      within(vehicle)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Tất cả 15 loại xe", "Giường nằm", "Cabin / phòng"]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["relevance", "departure", "price-asc", "price-desc"])(
    "emits detached URL params for sort %s, preserving all other entries and encoded core",
    async (sort) => {
      const source = new URLSearchParams(
        core + "&sort=old&vehicleType=cabin-22&extra=a&extra=b",
      );
      source.set("originId", "bến &/?#=一");
      const snapshot = source.toString();
      const onChange = vi.fn();
      render(<TripFilters searchParams={source} onChange={onChange} />);
      await userEvent.selectOptions(
        within(panel()).getByLabelText("Sắp xếp"),
        sort,
      );
      expect(onChange).toHaveBeenCalledTimes(1);
      const replacement: unknown = onChange.mock.calls[0]?.[0];
      expect(replacement).toBeInstanceOf(URLSearchParams);
      if (!(replacement instanceof URLSearchParams))
        throw new Error("Expected URLSearchParams");
      expect(replacement).not.toBe(source);
      const expected = new URLSearchParams(snapshot);
      if (sort === "relevance") expected.delete("sort");
      else expected.set("sort", sort);
      expected.delete("page");
      expect([...replacement]).toEqual([...expected]);
      expect(new URLSearchParams(replacement.toString()).get("originId")).toBe(
        "bến &/?#=一",
      );
      expect(source.toString()).toBe(snapshot);
    },
  );

  it("updates optional vehicle and keeps controls controlled by the latest URL props", async () => {
    render(<FilterHarness />);
    const vehicle = within(panel()).getByLabelText("Loại xe");
    await userEvent.selectOptions(vehicle, "sleeper-34");
    expect(vehicle).toHaveValue("sleeper-34");
    expect(screen.getByLabelText("Query").textContent).not.toContain(
      "vehicleType",
    );
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Áp dụng bộ lọc" }),
    );
    expect(
      new URLSearchParams(screen.getByLabelText("Query").textContent ?? "").get(
        "vehicleType",
      ),
    ).toBe("sleeper-34");
    await userEvent.selectOptions(vehicle, "cabin-22");
    expect(vehicle).toHaveValue("cabin-22");
    await userEvent.selectOptions(vehicle, "");
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Áp dụng bộ lọc" }),
    );
    expect(screen.getByLabelText("Query").textContent).not.toContain(
      "vehicleType",
    );
  });

  it("reset deletes all filter state including duplicates while preserving core and unrelated entries", async () => {
    const source = new URLSearchParams(
      core +
        "&sort=price-asc&sort=price-desc&vehicleType=cabin-22&vehicleType=sleeper-34&departurePeriod=evening&departureHour=20%3A00&minFare=250000&maxFare=400000&wifi=0&charging=0&restroom=1&doorPickup=1&page=3&extra=a&extra=b&reason=expired",
    );
    const snapshot = source.toString();
    const onChange = vi.fn();
    render(<TripFilters searchParams={source} onChange={onChange} />);
    await userEvent.click(
      within(panel()).getByRole("button", { name: "Đặt lại" }),
    );
    const expected = new URLSearchParams(snapshot);
    expected.delete("sort");
    for (const key of [
      "vehicleType",
      "departurePeriod",
      "departureHour",
      "minFare",
      "maxFare",
      "wifi",
      "charging",
      "restroom",
      "doorPickup",
      "page",
    ])
      expected.delete(key);
    expect(onChange).toHaveBeenCalledTimes(1);
    const replacement: unknown = onChange.mock.calls[0]?.[0];
    if (!(replacement instanceof URLSearchParams))
      throw new Error("Expected URLSearchParams");
    expect([...replacement]).toEqual([...expected]);
    expect(replacement).not.toBe(source);
    expect(source.toString()).toBe(snapshot);
  });

  it("falls back safely for malformed/duplicate overrides without rewriting the URL on render", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TripFilters
        searchParams={
          new URLSearchParams(core + "&sort=unexpected&vehicleType=unknown")
        }
        onChange={onChange}
      />,
    );
    expect(within(panel()).getByLabelText("Sắp xếp")).toHaveValue("relevance");
    expect(within(panel()).getByLabelText("Loại xe")).toHaveValue("");
    rerender(
      <TripFilters
        searchParams={
          new URLSearchParams(
            core +
              "&sort=price-asc&sort=price-desc&vehicleType=cabin-22&vehicleType=sleeper-34",
          )
        }
        onChange={onChange}
      />,
    );
    expect(within(panel()).getByLabelText("Sắp xếp")).toHaveValue("relevance");
    expect(within(panel()).getByLabelText("Loại xe")).toHaveValue("");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("stages every enabled filter, applies one canonical URL transaction, and resets page", async () => {
    render(<FilterHarness initial={`${core}&page=4`} />);
    const region = panel();
    const user = userEvent.setup();
    await user.selectOptions(
      within(region).getByLabelText("Loại xe"),
      "cabin-22",
    );
    await user.click(within(region).getByRole("button", { name: "Chiều" }));
    fireEvent.change(within(region).getByLabelText("Giờ xuất phát"), {
      target: { value: "13:00" },
    });
    const minimum = within(region).getByLabelText("Giá tối thiểu");
    minimum.focus();
    expect(minimum).toHaveFocus();
    fireEvent.change(minimum, {
      target: { value: "300000" },
    });
    fireEvent.change(within(region).getByLabelText("Giá tối đa"), {
      target: { value: "400000" },
    });
    await user.click(
      within(region).getByRole("checkbox", { name: "Có Wi-Fi" }),
    );
    await user.click(
      within(region).getByRole("checkbox", { name: "Cổng sạc" }),
    );
    await user.click(
      within(region).getByRole("checkbox", { name: "Nhà vệ sinh" }),
    );
    await user.click(
      within(region).getByRole("checkbox", { name: "Đón tận nơi" }),
    );
    expect(screen.getByLabelText("Query")).toHaveTextContent("page=4");

    await user.click(
      within(region).getByRole("button", { name: "Áp dụng bộ lọc" }),
    );
    const applied = new URLSearchParams(
      screen.getByLabelText("Query").textContent ?? "",
    );
    expect(Object.fromEntries(applied)).toMatchObject({
      vehicleType: "cabin-22",
      departurePeriod: "afternoon",
      departureHour: "13:00",
      minFare: "300000",
      maxFare: "400000",
      wifi: "0",
      charging: "0",
      restroom: "1",
      doorPickup: "1",
    });
    expect(applied.has("page")).toBe(false);
  });

  it("mobile Dialog opens by keyboard, traps focus, updates URL, and returns focus on Escape/close", async () => {
    render(<FilterHarness />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: "Bộ lọc và sắp xếp" });
    trigger.focus();
    await user.keyboard("{Enter}");
    const dialog = screen.getByRole("dialog", { name: "Bộ lọc và sắp xếp" });
    expect(dialog).toHaveAccessibleDescription(
      "Chọn điều kiện rồi nhấn Áp dụng bộ lọc. Đặt lại giữ nguyên hành trình và hành khách.",
    );
    const reset = within(dialog).getByRole("button", { name: "Đặt lại" });
    await waitFor(() => expect(reset).toHaveFocus());
    await user.tab({ shift: true });
    expect(
      within(dialog).getByRole("button", { name: "Áp dụng bộ lọc" }),
    ).toHaveFocus();
    await user.tab();
    expect(reset).toHaveFocus();
    await user.selectOptions(
      within(dialog).getByLabelText("Sắp xếp"),
      "price-desc",
    );
    await user.keyboard("{Escape}");
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(within(panel()).getByLabelText("Sắp xếp")).toHaveValue("price-desc");
    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: "Đóng bộ lọc" }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("closes on desktop breakpoint and removes the media listener on unmount", async () => {
    const { unmount } = render(<FilterHarness />);
    await userEvent.click(
      screen.getByRole("button", { name: "Bộ lọc và sắp xếp" }),
    );
    const listener = desktopQuery.addEventListener.mock.calls[0]?.[1];
    expect(listener).toBeDefined();
    act(() => {
      listener?.();
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    desktopQuery.matches = true;
    act(() => {
      listener?.();
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    unmount();
    expect(desktopQuery.removeEventListener).toHaveBeenCalledWith(
      "change",
      listener,
    );
  });

  it("does not read matchMedia during server rendering", () => {
    const media = vi.mocked(window.matchMedia);
    media.mockClear();
    expect(
      renderToString(
        <TripFilters
          searchParams={new URLSearchParams(core)}
          onChange={vi.fn()}
        />,
      ),
    ).toContain("Sắp xếp");
    expect(media).not.toHaveBeenCalled();
  });
});
