export const STARTUP_SESSION_KEY = "blue-startup-seen";
const FORCE_STARTUP_KEY = "blue-startup-force";

export function hasSeenStartup(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.dataset.blueStartup === "force") return false;
  const navigation = window.performance.getEntriesByType("navigation")[0] as
    PerformanceNavigationTiming | undefined;
  if (navigation?.type === "reload") return true;
  try {
    return window.sessionStorage.getItem(STARTUP_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

// Decide before the first paint. The server also marks a native hard refresh.
export const STARTUP_BOOTSTRAP_SCRIPT = `try {
  const forced = sessionStorage.getItem("${FORCE_STARTUP_KEY}") === "1" ||
    document.cookie.split("; ").includes("${FORCE_STARTUP_KEY}=1");
  sessionStorage.removeItem("${FORCE_STARTUP_KEY}");
  document.cookie = "${FORCE_STARTUP_KEY}=; Max-Age=0; Path=/; SameSite=Lax";
  if (forced) {
    document.documentElement.dataset.blueStartup = "force";
  } else if (performance.getEntriesByType("navigation")[0]?.type === "reload" ||
      sessionStorage.getItem("${STARTUP_SESSION_KEY}") === "1") {
    document.documentElement.dataset.blueStartup = "seen";
  }
} catch {}`;

export function rememberHardRefresh(event: KeyboardEvent): void {
  const hardRefresh =
    (event.key === "F5" && event.ctrlKey) ||
    (event.key.toLowerCase() === "r" &&
      event.shiftKey &&
      (event.ctrlKey || event.metaKey));
  if (!hardRefresh) return;
  try {
    window.sessionStorage.setItem(FORCE_STARTUP_KEY, "1");
  } catch {
    // Docker also detects hard-refresh request headers.
  }
}
