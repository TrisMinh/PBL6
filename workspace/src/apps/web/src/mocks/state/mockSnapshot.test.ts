import { afterEach, describe, expect, it, vi } from "vitest";

import {
  browserMockStorage,
  MOCK_BOOKING_STORAGE_KEY,
} from "@/mocks/state/mockSnapshot";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("mock browser storage adapter", () => {
  it("is lazy until requested and uses only its dedicated key", () => {
    browserMockStorage.setItem(MOCK_BOOKING_STORAGE_KEY, "snapshot");
    expect(browserMockStorage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBe(
      "snapshot",
    );
    browserMockStorage.removeItem(MOCK_BOOKING_STORAGE_KEY);
    expect(browserMockStorage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  });
  it("never accesses browser storage in production", () => {
    vi.stubEnv("PROD", true);
    vi.stubEnv("DEV", true);
    vi.stubEnv("MODE", "test");
    const get = vi.spyOn(Storage.prototype, "getItem");
    browserMockStorage.setItem(MOCK_BOOKING_STORAGE_KEY, "snapshot");
    expect(browserMockStorage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
    expect(get).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  });
  it("is safe without window or with a denied storage property", () => {
    vi.stubGlobal("window", undefined);
    expect(browserMockStorage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
    vi.unstubAllGlobals();
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => {
      throw new DOMException("Denied");
    });
    expect(browserMockStorage.getItem(MOCK_BOOKING_STORAGE_KEY)).toBeNull();
  });
});
