import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, expect, it } from "vitest";

import { liveQueryKey } from "@/shared/api/liveRequest";
import { LiveRouteEditor } from "./LiveOperatorForms";

afterEach(cleanup);

it("hydrates a loaded route once and preserves unsaved edits across background refreshes", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  const key = liveQueryKey("operator-routes");
  const route = {
    id: "route-test",
    name: "Tuyến Hồ Chí Minh — Đà Lạt",
    origin: "Hồ Chí Minh",
    destination: "Đà Lạt",
    distanceKm: 300,
    durationMinutes: 420,
    expectedVersion: 4,
  };
  client.setQueryData(key, [route]);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/operator/routes/route-test/edit"]}>
        <Routes>
          <Route
            path="/operator/routes/:routeId/edit"
            element={<LiveRouteEditor edit />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const input = screen.getByLabelText("Tên tuyến");
  expect(input).toHaveValue(route.name);
  const user = userEvent.setup();
  await user.clear(input);
  await user.type(input, "Tuyến đang chỉnh sửa");
  act(() =>
    client.setQueryData(key, [
      { ...route, name: "Tên mới từ máy chủ", expectedVersion: 5 },
    ]),
  );
  expect(input).toHaveValue("Tuyến đang chỉnh sửa");
  client.clear();
});
