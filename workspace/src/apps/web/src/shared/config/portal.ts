export type Portal = "customer" | "operator" | "admin";
export const portal: Portal =
  import.meta.env.VITE_APP_TARGET === "operator"
    ? "operator"
    : import.meta.env.VITE_APP_TARGET === "admin"
      ? "admin"
      : "customer";
export const portalHome =
  portal === "operator"
    ? "/operator/trips"
    : portal === "admin"
      ? "/admin/organizations"
      : "/";
export const portalSessionKey = "blue-staff-portal";

export function portalRedirect(input: unknown): string {
  if (
    typeof input !== "string" ||
    !input.startsWith("/") ||
    input.startsWith("//") ||
    /[\\\s#%]/.test(input)
  )
    return portalHome;
  const url = new URL(input, "https://blue.invalid");
  return url.pathname.startsWith(`/${portal}/`)
    ? url.pathname + url.search
    : portalHome;
}
