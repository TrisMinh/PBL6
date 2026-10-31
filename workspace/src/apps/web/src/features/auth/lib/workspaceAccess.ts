import { readApiSession, type StoredSession } from "@/shared/api/session";

export function workspaceAccess(
  session: StoredSession | null = readApiSession(),
): { admin: boolean; operator: boolean; home: string; label: string } {
  const roles = [
    ...(session?.user.roles ?? []),
    ...(session?.user.organizationMemberships ?? [])
      .filter((membership) => membership.status === "ACTIVE")
      .flatMap((membership) => membership.roleCodes),
  ];
  const admin = roles.includes("PLATFORM_ADMIN");
  const operator = roles.some(
    (role) => role.startsWith("OPERATOR_") || role === "DRIVER",
  );
  const home = admin
    ? "/admin/organizations"
    : operator
      ? "/operator/trips"
      : "/account/tickets";
  return {
    admin,
    operator,
    home,
    label: admin
      ? "Quản trị hệ thống"
      : operator
        ? "Quản lý nhà xe"
        : "Hành trình của tôi",
  };
}

/** Only allow a local path in the signed-in user's workspace. The API still enforces permissions. */
export function workspaceRedirect(
  input: unknown,
  session: StoredSession | null = readApiSession(),
): string {
  const access = workspaceAccess(session);
  if (
    typeof input !== "string" ||
    input.length > 2048 ||
    !input.startsWith("/") ||
    input.startsWith("//") ||
    /[\\\s#]/.test(input)
  )
    return access.home;
  const url = new URL(input, "https://blue.invalid");
  if (/%2f|%5c|%2e/i.test(url.pathname)) return access.home;
  if (url.pathname.startsWith("/operator/") && !access.operator)
    return access.home;
  if (url.pathname.startsWith("/admin/") && !access.admin) return access.home;
  if (
    /^\/(?:operator|admin)\//.test(url.pathname) ||
    /^\/(?:booking|bookings|payment|tickets)\//.test(url.pathname) ||
    ["/", "/trips", "/explore", "/account/tickets"].includes(url.pathname)
  )
    return url.pathname + url.search;
  return access.home;
}
