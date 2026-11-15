import { afterEach, expect, it } from "vitest";
import {
  homeSearchPath,
  readRecentSearches,
  rememberSearch,
  removeRecentSearch,
  RECENT_SEARCHES_KEY,
} from "./recentSearches";
const entry = {
  search: {
    originId: "loc-hcm",
    destinationId: "loc-dalat",
    departureDate: "2099-01-01",
    passengerCount: 2,
    sort: "relevance" as const,
  },
  originLabel: "TP. Hồ Chí Minh",
  destinationLabel: "Đà Lạt",
};
afterEach(() => localStorage.removeItem(RECENT_SEARCHES_KEY));
it("keeps four recent searches, promotes duplicates and removes one without removing the others", () => {
  for (let count = 1; count <= 6; count++)
    rememberSearch({
      ...entry,
      search: { ...entry.search, passengerCount: count },
    });
  expect(
    readRecentSearches().map((item) => item.search.passengerCount),
  ).toEqual([6, 5, 4, 3]);
  rememberSearch({ ...entry, search: { ...entry.search, passengerCount: 4 } });
  expect(
    readRecentSearches().map((item) => item.search.passengerCount),
  ).toEqual([4, 6, 5, 3]);
  removeRecentSearch(homeSearchPath({ ...entry.search, passengerCount: 6 }));
  expect(
    readRecentSearches().map((item) => item.search.passengerCount),
  ).toEqual([4, 5, 3]);
  removeRecentSearch();
  expect(readRecentSearches()).toEqual([]);
});
it("ignores corrupt, expired and invalid searches from storage", () => {
  localStorage.setItem(RECENT_SEARCHES_KEY, "not json");
  expect(readRecentSearches()).toEqual([]);
  localStorage.setItem(
    RECENT_SEARCHES_KEY,
    JSON.stringify([
      entry,
      { ...entry, search: { ...entry.search, departureDate: "2000-01-01" } },
      { ...entry, search: { ...entry.search, passengerCount: 9 } },
    ]),
  );
  expect(readRecentSearches()).toEqual([entry]);
});
