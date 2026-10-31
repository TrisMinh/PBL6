/** Live is the default. Mock data must be explicitly enabled outside tests. */
export const isMockApi =
  import.meta.env.MODE === "test" || import.meta.env.VITE_API_MODE === "mock";

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(
  /\/$/,
  "",
);
