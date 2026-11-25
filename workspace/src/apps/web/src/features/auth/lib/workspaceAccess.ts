import { readApiSession, type StoredSession } from "@/shared/api/session";

function activeOrganizationRoles(session: StoredSession | null): string[] {
  const payload = session?.accessToken.split(".")[1];
  if (!payload) return [];
  try {
    const claims = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    const roles: unknown[] = Array.isArray(claims?.org_role)
      ? claims.org_role
      : [claims?.org_role];
    return typeof claims?.org === "string"
      ? roles.filter((role): role is string => typeof role === "string")
      : [];
  } catch {
    return [];
  }
}

export function driverOnly(session = readApiSession()): boolean {
  const roles = activeOrganizationRoles(session);
  return (
    roles.includes("DRIVER") &&
    !roles.some((role) => role.startsWith("OPERATOR_"))
  );
}

export function canReissueDriverPassword(session = readApiSession()): boolean {
  return activeOrganizationRoles(session).includes("OPERATOR_ADMIN");
}

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
      ? driverOnly(session)
        ? "/operator/my-trips"
        : "/operator/trips"
      : "/account/tickets";
  return {
    admin,
    operator,
    home,
    label: admin
      ? "Quản trị hệ thống"
      : operator
        ? driverOnly(session)
          ? "Chuyến của tôi"
          : "Quản lý nhà xe"
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
  if (
    url.pathname.startsWith("/operator/") &&
    driverOnly(session) &&
    url.pathname !== "/operator/my-trips"
  )
    return access.home;
  if (url.pathname.startsWith("/admin/") && !access.admin) return access.home;
  if (
    /^\/(?:operator|admin)\//.test(url.pathname) ||
    /^\/(?:booking|bookings|payment|tickets)\//.test(url.pathname) ||
    /^\/refunds\/[0-9a-f-]{36}$/i.test(url.pathname) ||
    /^\/trips\/[A-Za-z0-9_-]{1,128}\/seats$/.test(url.pathname) ||
    ["/", "/trips", "/explore", "/account/tickets"].includes(url.pathname)
  )
    return url.pathname + url.search;
  return access.home;
}
