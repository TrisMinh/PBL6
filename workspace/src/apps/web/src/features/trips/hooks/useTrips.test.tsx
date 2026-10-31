import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { PropsWithChildren, ReactElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { tripKeys } from "@/features/trips/api/tripQueryKeys";
import { useLocations } from "@/features/trips/hooks/useLocations";
import { useTrips } from "@/features/trips/hooks/useTrips";
import { selectVisibleTrips } from "@/features/trips/lib/tripResults";
import type { TripSearch } from "@/features/trips/types/trip";
import { locations } from "@/mocks/fixtures/locations";
import { trips } from "@/mocks/fixtures/trips";
import { server } from "@/mocks/server";

const SEARCH: TripSearch = {
  originId: "loc-hcm",
  destinationId: "loc-dalat",
  departureDate: "2099-01-01",
  passengerCount: 2,
  sort: "departure",
};
const clients: QueryClient[] = [];

function queryWrapper(): {
  client: QueryClient;
  wrapper: (props: PropsWithChildren) => ReactElement;
} {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  function Wrapper({ children }: PropsWithChildren): ReactElement {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  return { wrapper: Wrapper, client };
}

afterEach(() => {
  clients.forEach((client) => client.clear());
  clients.length = 0;
});

describe("trip query hooks over MSW", () => {
  it("loads locations into the canonical query cache", async () => {
    const { wrapper, client } = queryWrapper();
    const { result } = renderHook(() => useLocations(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(locations);
    expect(client.getQueryData(tripKeys.locations())).toEqual(locations);
  });

  it("loads trips and keeps distinct sort searches in separate cache entries", async () => {
    const { wrapper, client } = queryWrapper();
    const { result, rerender } = renderHook(
      (input: TripSearch) => useTrips(input),
      { wrapper, initialProps: SEARCH },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const canonicalTrips = trips.slice(0, 24);
    expect(result.current.data).toEqual(
      selectVisibleTrips(canonicalTrips, "departure"),
    );
    const sorted: TripSearch = { ...SEARCH, sort: "price-asc" };
    rerender(sorted);
    await waitFor(() =>
      expect(result.current.data?.[0].id).toBe("trip-hcm-dalat-page-09"),
    );
    expect(client.getQueryData(tripKeys.search(SEARCH))).toEqual(
      selectVisibleTrips(canonicalTrips, "departure"),
    );
    expect(client.getQueryData(tripKeys.search(sorted))).toEqual(
      selectVisibleTrips(canonicalTrips, "price-asc"),
    );
  });

  it("exposes a typed safe HTTP error for locations", async () => {
    server.use(
      http.get("/api/v1/locations", () =>
        HttpResponse.json({ detail: "private" }, { status: 503 }),
      ),
    );
    const { wrapper } = queryWrapper();
    const { result } = renderHook(() => useLocations(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: "HTTP_ERROR",
      status: 503,
      messageKey: "trips.errors.request",
      canRetry: true,
    });
    expect(result.current.data).toBeUndefined();
  });

  it("exposes a typed contract error without caching malformed trips", async () => {
    server.use(
      http.get("/api/v1/trips", () =>
        HttpResponse.json({ items: [{ id: "private" }], total: 1 }),
      ),
    );
    const { wrapper, client } = queryWrapper();
    const { result } = renderHook(() => useTrips(SEARCH), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({
      code: "INVALID_RESPONSE",
      messageKey: "trips.errors.response",
    });
    expect(client.getQueryData(tripKeys.search(SEARCH))).toBeUndefined();
  });

  it.each(["locations", "trips"])(
    "cancels the %s network request on unmount",
    async (resource) => {
      let onStart: (signal: AbortSignal) => void = () => undefined;
      const started = new Promise<AbortSignal>((resolve) => {
        onStart = resolve;
      });
      let release: () => void = () => undefined;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      server.use(
        http.get(`/api/v1/${resource}`, async ({ request }) => {
          onStart(request.signal);
          await held;
          return HttpResponse.json({ items: [], total: 0 });
        }),
      );
      const { wrapper } = queryWrapper();
      // Both hooks stay in a fixed order; only the active request is held by MSW.
      const { unmount } = renderHook(
        () => ({ locations: useLocations(), trips: useTrips(SEARCH) }),
        { wrapper },
      );
      const signal = await started;
      unmount();
      expect(signal.aborted).toBe(true);
      release();
    },
  );
});
