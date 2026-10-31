import { afterEach, expect, it, vi } from "vitest";

import { enableMocking } from "@/app/enableMocking";

const { start } = vi.hoisted(() => ({
  start: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/mocks/browser", () => ({ worker: { start } }));
afterEach(() => {
  start.mockClear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("disables mock request/response logging so passenger PII stays out of browser console", async () => {
  vi.stubEnv("DEV", true);
  await enableMocking();
  expect(start).toHaveBeenCalledWith({
    onUnhandledFrame: "bypass",
    quiet: true,
  });
});
it("does not start browser mocks in production", async () => {
  vi.stubEnv("DEV", false);
  await enableMocking();
  expect(start).not.toHaveBeenCalled();
});
it("does not start browser mocks during server rendering", async () => {
  vi.stubEnv("DEV", true);
  vi.stubGlobal("window", undefined);
  await enableMocking();
  expect(start).not.toHaveBeenCalled();
});
