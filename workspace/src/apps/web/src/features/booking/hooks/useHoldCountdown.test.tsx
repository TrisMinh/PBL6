import { act, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { StrictMode, type PropsWithChildren, type ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  useHoldCountdown,
  type HoldCountdown,
} from "@/features/booking/hooks/useHoldCountdown";

const NOW = Date.parse("2026-10-20T00:00:00Z");
const EXPIRY = "2026-10-20T00:10:00Z";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useHoldCountdown — FR-011", () => {
  it("same-expiry rerenders preserve the elapsed hold rather than restarting a timer window", () => {
    const { result, rerender } = renderHook(
      (expiry) => useHoldCountdown(expiry),
      { initialProps: EXPIRY },
    );
    act(() => vi.advanceTimersByTime(300_000));
    expect(result.current.remainingSeconds).toBe(300);
    rerender(EXPIRY);
    expect(result.current.remainingSeconds).toBe(300);
    expect(vi.getTimerCount()).toBe(1);
  });

  it("evaluates after the neutral first render and recomputes 600 to599 each second", () => {
    const observed: HoldCountdown[] = [];
    const { result } = renderHook(() => {
      const value = useHoldCountdown(EXPIRY);
      observed.push(value);
      return value;
    });
    expect(observed[0]).toEqual({ remainingSeconds: 0, isExpired: false });
    expect(result.current).toEqual({ remainingSeconds: 600, isExpired: false });
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toEqual({ remainingSeconds: 599, isExpired: false });
    expect(vi.getTimerCount()).toBe(1);
  });
  it("uses ceil for a partial second and stops exactly at expiry", () => {
    const { result } = renderHook(() =>
      useHoldCountdown(new Date(NOW + 1_500).toISOString()),
    );
    expect(result.current.remainingSeconds).toBe(2);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.remainingSeconds).toBe(1);
    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toEqual({ remainingSeconds: 0, isExpired: true });
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.remainingSeconds).toBe(0);
  });
  it("refresh/remount at300seconds uses original expiry rather than restarting", () => {
    const first = renderHook(() => useHoldCountdown(EXPIRY));
    expect(first.result.current.remainingSeconds).toBe(600);
    first.unmount();
    vi.setSystemTime(NOW + 300_000);
    const next = renderHook(() => useHoldCountdown(EXPIRY));
    expect(next.result.current.remainingSeconds).toBe(300);
  });
  it.each(["visibilitychange", "focus"])(
    "immediately catches a suspended tab jump on%s and does not duplicate timers",
    (event) => {
      const { result } = renderHook(() => useHoldCountdown(EXPIRY));
      vi.setSystemTime(NOW + 400_000);
      act(() =>
        (event === "focus" ? window : document).dispatchEvent(new Event(event)),
      );
      expect(result.current.remainingSeconds).toBe(200);
      expect(vi.getTimerCount()).toBe(1);
      vi.setSystemTime(NOW + 700_000);
      act(() =>
        (event === "focus" ? window : document).dispatchEvent(new Event(event)),
      );
      expect(result.current).toEqual({ remainingSeconds: 0, isExpired: true });
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("each timer reads Date.now after a clock jump instead of decrementing a captured counter", () => {
    const { result } = renderHook(() => useHoldCountdown(EXPIRY));
    vi.setSystemTime(NOW + 299_000);
    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current.remainingSeconds).toBe(300);
  });
  it("replacement expiry returns neutral first and never reuses the old session snapshot", () => {
    const observed: HoldCountdown[] = [];
    const { result, rerender } = renderHook(
      (expiry) => {
        const value = useHoldCountdown(expiry);
        observed.push(value);
        return value;
      },
      { initialProps: EXPIRY },
    );
    expect(result.current.remainingSeconds).toBe(600);
    vi.setSystemTime(NOW + 120_000);
    observed.length = 0;
    rerender("2026-10-20T00:01:00Z");
    expect(observed[0]).toEqual({ remainingSeconds: 0, isExpired: false });
    expect(result.current).toEqual({ remainingSeconds: 0, isExpired: true });
    expect(vi.getTimerCount()).toBe(0);
    rerender("2026-10-20T00:05:00Z");
    expect(result.current.remainingSeconds).toBe(180);
    expect(vi.getTimerCount()).toBe(1);
  });
  it.each(["invalid", "", "2026-10-20T00:00:00Z", "2026-10-19T23:59:59Z"])(
    "invalid/equal/past expiry%s settles expired without a timer",
    (expiry) => {
      const { result } = renderHook(() => useHoldCountdown(expiry));
      expect(result.current).toEqual({ remainingSeconds: 0, isExpired: true });
      expect(vi.getTimerCount()).toBe(0);
    },
  );
  it("removes the matching timer and listeners on expiry change/unmount", () => {
    const addWindow = vi.spyOn(window, "addEventListener");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const addDocument = vi.spyOn(document, "addEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const { rerender, unmount } = renderHook(
      (expiry) => useHoldCountdown(expiry),
      { initialProps: EXPIRY },
    );
    const focus = addWindow.mock.calls.find(([name]) => name === "focus")?.[1];
    const visibility = addDocument.mock.calls.find(
      ([name]) => name === "visibilitychange",
    )?.[1];
    expect(focus).toBeDefined();
    expect(visibility).toBeDefined();
    rerender("2026-10-20T00:05:00Z");
    expect(removeWindow).toHaveBeenCalledWith("focus", focus);
    expect(removeDocument).toHaveBeenCalledWith("visibilitychange", visibility);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(
      removeWindow.mock.calls.filter(([event]) => event === "focus"),
    ).toHaveLength(2);
    expect(
      removeDocument.mock.calls.filter(
        ([event]) => event === "visibilitychange",
      ),
    ).toHaveLength(2);
    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("strict-mode effect replay has only one active timer", () => {
    function Wrapper({ children }: PropsWithChildren): ReactElement {
      return <StrictMode>{children}</StrictMode>;
    }
    const { result, unmount } = renderHook(() => useHoldCountdown(EXPIRY), {
      wrapper: Wrapper,
    });
    expect(result.current.remainingSeconds).toBe(600);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("SSR render needs no window/document and returns hydration-neutral output", () => {
    function Probe(): ReactElement {
      const value = useHoldCountdown(EXPIRY);
      return <output>{JSON.stringify(value)}</output>;
    }
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("document", undefined);
    const html = renderToString(<Probe />);
    expect(html).toContain("&quot;remainingSeconds&quot;:0");
    expect(html).toContain("&quot;isExpired&quot;:false");
    expect(vi.getTimerCount()).toBe(0);
  });
});
