import { describe, expect, it } from "vitest";

import { adminKeys } from "@/features/admin/api/adminQueryKeys";
import type { AdminListParams } from "@/features/admin/schemas/adminListParams.schema";

const PARAMS: AdminListParams = {
  query: "demo",
  status: "active",
  organizationId: "org-blue-demo",
  page: 2,
  pageSize: 10,
};

describe("admin query keys", () => {
  it("uses hierarchical collision-free resource keys", () => {
    expect(adminKeys.all).toEqual(["admin"]);
    expect(adminKeys.organizations.list(PARAMS)).toEqual([
      "admin",
      "organizations",
      "list",
      PARAMS,
    ]);
    expect(adminKeys.organizations.detail("org-blue-demo")).toEqual([
      "admin",
      "organizations",
      "detail",
      "org-blue-demo",
    ]);
    expect(adminKeys.organizations.list(PARAMS)).not.toEqual(
      adminKeys.staff.list(PARAMS),
    );
    expect(adminKeys.bookings.detail("same-id")).not.toEqual(
      adminKeys.payments.detail("same-id"),
    );
  });

  it("detaches and freezes canonical params without credentials", () => {
    const input = { ...PARAMS, sessionToken: "must-not-enter-key" };
    const key = adminKeys.refunds.list(input);
    input.query = "caller-mutation";

    expect(key[3]).toEqual(PARAMS);
    expect(JSON.stringify(key)).not.toContain("must-not-enter-key");
    expect(Object.isFrozen(adminKeys.all)).toBe(true);
    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.isFrozen(key[3])).toBe(true);
    expect(Reflect.set(key, 0, "changed")).toBe(false);
    expect(adminKeys.bookings.list({ page: 1, pageSize: 20 })[3]).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it.each<keyof AdminListParams>([
    "query",
    "status",
    "organizationId",
    "page",
    "pageSize",
  ])("includes %s in list cache identity", (field) => {
    const changed = {
      ...PARAMS,
      [field]: field === "page" || field === "pageSize" ? 99 : "different",
    } as AdminListParams;
    expect(adminKeys.staff.list(changed)).not.toEqual(
      adminKeys.staff.list(PARAMS),
    );
  });
});
