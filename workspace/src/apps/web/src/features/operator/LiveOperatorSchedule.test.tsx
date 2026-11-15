import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as liveRequest from "@/shared/api/liveRequest";
import type { ApiRow } from "@/shared/api/fields";
import { LiveOperatorSchedule } from "./LiveOperatorSchedule";

vi.mock("./schedule/SchedulePage", () => ({
  ScheduleCard: ({ statusLabel }: { statusLabel: string }): ReactElement => (
    <article>{statusLabel}</article>
  ),
}));
vi.mock("./LiveDriverAssignments", () => ({
  LiveDriverAssignments: (): null => null,
}));
vi.mock("./LiveOrganizationProfile", () => ({
  LiveOrganizationProfile: (): null => null,
}));

let trip: ApiRow;
const clients: QueryClient[] = [];
beforeEach(() => {
  trip = {
    id: "new-trip",
    origin: "Đà Nẵng",
    destination: "Huế",
    departureAt: "2027-03-23T01:00:00Z",
    arrivalAt: "2027-03-23T04:00:00Z",
    status: "SCHEDULED",
    sellable: false,
  };
  vi.spyOn(liveRequest, "getLiveRows").mockImplementation(async (path) =>
    path === "/api/v1/operator/trips" ? [trip] : [],
  );
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});
function show(fromPublication = true): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/operator/trips",
            search: "?highlight=new-trip",
            state: fromPublication ? { publishedTripId: "new-trip" } : null,
          },
        ]}
      >
        <LiveOperatorSchedule />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}
it("announces sale readiness only after the backend marks the newly published trip sellable", async () => {
  const client = show();
  await screen.findByText("Đang mở bán…");
  expect(screen.queryByText("Chuyến đã mở bán")).not.toBeInTheDocument();
  trip = { ...trip, sellable: true };
  await act(() => client.invalidateQueries({ queryKey: ["live-api"] }));
  expect(await screen.findByText("Chuyến đã mở bán")).toBeVisible();
});
it("does not replay a publication notification when opening the schedule directly", async () => {
  trip = { ...trip, sellable: true };
  show(false);
  await screen.findByText("Đang bán");
  expect(screen.queryByText("Chuyến đã mở bán")).not.toBeInTheDocument();
});
