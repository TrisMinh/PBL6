export const STARTUP_SESSION_KEY = "blue-startup-seen";

export function hasSeenStartup(): boolean {
  if (typeof window === "undefined") return false;
  const navigation = window.performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (navigation?.type === "reload") return true;
  try {
    return window.sessionStorage.getItem(STARTUP_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

// Read before the first paint so a reload never flashes the startup screen.
export const STARTUP_BOOTSTRAP_SCRIPT = `try {
  if (performance.getEntriesByType("navigation")[0]?.type === "reload" ||
      sessionStorage.getItem("${STARTUP_SESSION_KEY}") === "1") {
    document.documentElement.dataset.blueStartup = "seen";
  }
} catch {}`;
