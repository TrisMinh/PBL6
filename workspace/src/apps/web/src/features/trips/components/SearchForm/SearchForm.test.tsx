import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchForm } from "@/features/trips/components/SearchForm/SearchForm";
import { tripSearchSchema } from "@/features/trips/schemas/search.schema";
import { locations } from "@/mocks/fixtures/locations";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";

afterEach(() => vi.useRealTimers());

function fillValid(): void {
  fireEvent.change(screen.getByLabelText("Điểm đi"), {
    target: { value: "loc-hcm" },
  });
  fireEvent.change(screen.getByLabelText("Điểm đến"), {
    target: { value: "loc-dalat" },
  });
  fireEvent.change(screen.getByLabelText("Ngày đi"), {
    target: { value: "2099-01-01" },
  });
}

describe("SearchForm", () => {
  it("labels all controls and renders readonly location props and six passenger options", () => {
    render(<SearchForm locations={locations} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("form", { name: "Tìm chuyến" }),
    ).toBeInTheDocument();
    for (const label of ["Điểm đi", "Điểm đến", "Hành khách"])
      expect(screen.getByRole("combobox", { name: label })).toBeRequired();
    expect(screen.getByLabelText("Ngày đi")).toHaveAttribute("type", "date");
    const origin = screen.getByRole("combobox", { name: "Điểm đi" });
    expect(within(origin).getAllByRole("option")).toHaveLength(5);
    for (const location of locations)
      expect(
        within(origin).getByRole("option", {
          name: `${location.name} · ${location.province}`,
        }),
      ).toHaveValue(location.id);
    expect(
      within(screen.getByLabelText("Hành khách"))
        .getAllByRole("option")
        .map((option) => option.getAttribute("value")),
    ).toEqual(["1", "2", "3", "4", "5", "6"]);
    expect(screen.getByRole("button", { name: "Tìm chuyến" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("blocks empty fields and associates required errors", async () => {
    const submit = vi.fn();
    render(<SearchForm locations={locations} onSubmit={submit} />);
    await userEvent.click(screen.getByRole("button", { name: "Tìm chuyến" }));
    expect(await screen.findByText("Chọn điểm đi.")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(screen.getByLabelText("Điểm đi")).toHaveAccessibleDescription(
      "Chọn điểm đi.",
    );
    expect(screen.getByLabelText("Điểm đến")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Ngày đi")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Điểm đi")).toHaveFocus();
    expect(submit).not.toHaveBeenCalled();
  });

  it("links same-route error to destination and never submits", async () => {
    const submit = vi.fn();
    render(<SearchForm locations={locations} onSubmit={submit} />);
    fillValid();
    fireEvent.change(screen.getByLabelText("Điểm đến"), {
      target: { value: "loc-hcm" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Tìm chuyến" }));
    expect(
      await screen.findByText("Điểm đến phải khác điểm đi."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Điểm đến")).toHaveAccessibleDescription(
      "Điểm đến phải khác điểm đi.",
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it("shows the schema past-date error at the date input", async () => {
    const submit = vi.fn();
    render(<SearchForm locations={locations} onSubmit={submit} />);
    fillValid();
    fireEvent.change(screen.getByLabelText("Ngày đi"), {
      target: { value: "2000-01-01" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Tìm chuyến" }));
    expect(
      await screen.findByText("Ngày đi không được ở quá khứ."),
    ).toHaveAttribute("role", "alert");
    expect(screen.getByLabelText("Ngày đi")).toHaveAccessibleDescription(
      "Ngày đi không được ở quá khứ.",
    );
    expect(submit).not.toHaveBeenCalled();
  });

  it.each(["0", "7"])(
    "rejects passenger %s even if a tampered native option supplies it",
    async (value) => {
      const submit = vi.fn();
      render(<SearchForm locations={locations} onSubmit={submit} />);
      fillValid();
      const passenger = screen.getByLabelText("Hành khách");
      passenger.append(new Option(value, value));
      fireEvent.change(passenger, { target: { value } });
      await userEvent.click(screen.getByRole("button", { name: "Tìm chuyến" }));
      await waitFor(() =>
        expect(passenger).toHaveAttribute("aria-invalid", "true"),
      );
      expect(passenger).toHaveAttribute("aria-describedby");
      expect(submit).not.toHaveBeenCalled();
    },
  );

  it("submits exactly one canonical object with number count and default relevance sort", async () => {
    const submit = vi.fn();
    render(<SearchForm locations={locations} onSubmit={submit} />);
    fillValid();
    await userEvent.selectOptions(screen.getByLabelText("Hành khách"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Tìm chuyến" }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith({
      originId: "loc-hcm",
      destinationId: "loc-dalat",
      departureDate: "2099-01-01",
      passengerCount: 2,
      sort: "relevance",
    });
  });

  it("keeps native tab order from route through submit", async () => {
    render(<SearchForm locations={locations} onSubmit={vi.fn()} />);
    for (const label of ["Điểm đi", "Điểm đến", "Ngày đi", "Hành khách"]) {
      await userEvent.tab();
      expect(screen.getByLabelText(label)).toHaveFocus();
    }
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Tìm chuyến" })).toHaveFocus();
  });

  it("renders new location props without importing or mutating fixtures", () => {
    const { rerender } = render(
      <SearchForm locations={[]} onSubmit={vi.fn()} />,
    );
    expect(
      within(screen.getByLabelText("Điểm đi")).getAllByRole("option"),
    ).toHaveLength(1);
    rerender(
      <SearchForm
        locations={[
          {
            id: "custom",
            name: "Bến thử nghiệm",
            displayName: "Tỉnh mô phỏng",
            province: "Tỉnh mô phỏng",
          },
        ]}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      within(screen.getByLabelText("Điểm đến")).getByRole("option", {
        name: "Bến thử nghiệm · Tỉnh mô phỏng",
      }),
    ).toHaveValue("custom");
  });

  it("keeps server date min unset and refreshes the same schema boundary on focus", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T16:59:59Z"));
    expect(
      renderToString(<SearchForm locations={locations} onSubmit={vi.fn()} />),
    ).not.toContain('min="');
    render(<SearchForm locations={locations} onSubmit={vi.fn()} />);
    const date = screen.getByLabelText("Ngày đi");
    expect(date).toHaveAttribute("min", getVietnamTodayDate());
    vi.setSystemTime(new Date("2026-10-19T17:00:00Z"));
    fireEvent.focus(date);
    expect(date).toHaveAttribute("min", "2026-10-20");
    expect(
      tripSearchSchema.safeParse({
        originId: "a",
        destinationId: "b",
        departureDate: "2026-10-19",
        passengerCount: 1,
      }).success,
    ).toBe(false);
  });
});
