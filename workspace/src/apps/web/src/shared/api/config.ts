/** Standalone demos work without a backend. Live integration is an explicit opt-in. */
export const isMockApi =
  import.meta.env.MODE === "test" || import.meta.env.VITE_API_MODE !== "live";

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);
