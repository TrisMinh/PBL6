/** Configurable cross-site links; a local preview uses the same host as its current app. */
export function customerOrigin(): string {
  const configured = import.meta.env.VITE_CUSTOMER_ORIGIN as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  return `http://${typeof window === "undefined" ? "localhost" : window.location.hostname}:5173`;
}

export function operatorOrigin(): string {
  const configured = import.meta.env.VITE_OPERATOR_ORIGIN as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  return `http://${typeof window === "undefined" ? "localhost" : window.location.hostname}:5174`;
}
