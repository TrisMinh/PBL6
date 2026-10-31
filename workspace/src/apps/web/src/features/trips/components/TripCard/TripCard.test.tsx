import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TripCard } from "@/features/trips/components/TripCard/TripCard";
import type { Trip } from "@/features/trips/types/trip";
import { trips } from "@/mocks/fixtures/trips";

const availableTrip: Trip = trips[0];
const soldOutTrip = trips.find((trip) => trip.id === "trip-hcm-dalat-sold-out");
const overnightTrip = trips.find(
  (trip) => trip.id === "trip-hcm-dalat-evening",
);
if (!soldOutTrip || !overnightTrip)
  throw new Error("Missing canonical TripCard fixtures");

describe("TripCard", () => {
  it("renders an accessible trip article with operator, route, vehicle, times, duration, seats and fare", () => {
    render(<TripCard trip={availableTrip} onSelect={vi.fn()} />);
    const article = screen.getByRole("article", {
      name: "BLUE Expres. Hồ Chí Minh → Lâm Đồng",
    });
    expect(article).toHaveAttribute("data-vehicle-type", "cabin-22");
    expect(
      within(article).getByRole("heading", {
        name: "BLUE Expres.",
        level: 2,
      }),
    ).toBeVisible();
    for (const text of [
      "Limousine 11 chỗ",
      "Miền Đông mới",
      "Bến xe Đà Lạt",
      "07:00",
      "13:30",
      "6 giờ 30",
      "Còn 6 ghế",
      "320.000 ₫",
      "/ khách",
    ]) {
      expect(within(article).getByText(text)).toBeVisible();
    }
    expect(article.querySelectorAll("img")).toHaveLength(5);
    const times = article.querySelectorAll("time");
    expect(times[0]).toHaveAttribute("dateTime", availableTrip.departureTime);
    expect(times[1]).toHaveAttribute("dateTime", availableTrip.arrivalTime);
    expect(
      within(article).getByRole("button", { name: "Chọn chuyến" }),
    ).toBeEnabled();
    expect(article.querySelector("a")).toBeNull();
  });

  it("selects the exact supplied trip once on native keyboard activation without navigating", async () => {
    const onSelect = vi.fn();
    render(<TripCard trip={availableTrip} onSelect={onSelect} />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Chọn chuyến" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(availableTrip);
  });

  it("disables sold-out CTA and exposes the reason without invoking selection", async () => {
    const onSelect = vi.fn();
    render(<TripCard trip={soldOutTrip} onSelect={onSelect} />);
    const button = screen.getByRole("button", { name: "Chọn chuyến" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Hết chỗ");
    expect(screen.getByText("Hết chỗ")).toHaveClass(
      "trip-card__seats",
      "trip-card__seats--sold-out",
    );
    expect(screen.getByText("6 giờ 30")).toBeVisible();
    await userEvent.click(button);
    await userEvent.tab();
    expect(button).not.toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("keeps overnight arrival on its next Vietnam calendar day and calculates elapsed duration", () => {
    render(<TripCard trip={overnightTrip} onSelect={vi.fn()} />);
    for (const text of ["Giường phòng 21", "22:00", "04:00", "6 giờ"]) {
      expect(screen.getByText(text)).toBeVisible();
    }
  });

  it("gives each repeated card unique accessible associations", () => {
    render(
      <>
        <TripCard trip={availableTrip} onSelect={vi.fn()} />
        <TripCard trip={availableTrip} onSelect={vi.fn()} />
      </>,
    );
    const articles = screen.getAllByRole("article");
    expect(articles[0]?.getAttribute("aria-labelledby")).not.toBe(
      articles[1]?.getAttribute("aria-labelledby"),
    );
  });

  it("shows a duration shorter than an hour without a zero-hour prefix", () => {
    render(
      <TripCard
        trip={{
          ...availableTrip,
          arrivalTime: "2099-01-01T00:30:00Z",
        }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("30 phút")).toBeVisible();
  });

  it("shows a readable duration for a valid trip shorter than one minute", () => {
    render(
      <TripCard
        trip={{
          ...availableTrip,
          arrivalTime: "2099-01-01T00:00:30Z",
        }}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Dưới 1 phút")).toBeVisible();
  });
});

it.each([{ isPending: true }, { disabled: true }])(
  "blocks presentational pending/disabled CTA %j",
  async (props) => {
    const onSelect = vi.fn();
    render(<TripCard trip={availableTrip} onSelect={onSelect} {...props} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    if (props.isPending) expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onSelect).not.toHaveBeenCalled();
  },
);
