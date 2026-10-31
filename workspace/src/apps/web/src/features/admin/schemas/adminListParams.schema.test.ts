import { describe, expect, it } from "vitest";

import {
  adminListParamsSchema,
  parseAdminListParams,
} from "./adminListParams.schema";

describe("admin list params boundary", () => {
  it("applies canonical pagination defaults", () => {
    expect(parseAdminListParams(new URLSearchParams())).toEqual({
      page: 1,
      pageSize: 20,
    });
  });

  it("normalizes invalid pagination without dropping valid filters", () => {
    const parsed = parseAdminListParams(
      new URLSearchParams({
        organizationId: "org-blue-travel",
        page: "-2",
        pageSize: "101",
        query: "  Nguyen Van A  ",
        status: "active",
      }),
    );

    expect(parsed).toEqual({
      organizationId: "org-blue-travel",
      page: 1,
      pageSize: 20,
      query: "Nguyen Van A",
      status: "active",
    });
  });

  it.each(["0", "1.5", "1e2", "0x10", "NaN", ""])(
    "normalizes invalid page %j to page 1",
    (page) => {
      expect(parseAdminListParams(new URLSearchParams({ page })).page).toBe(1);
    },
  );

  it("ignores unknown and repeated statuses without exposing raw input", () => {
    const unknown = parseAdminListParams(
      new URLSearchParams({ query: "safe", status: "super-secret-status" }),
    );
    const repeatedParams = new URLSearchParams();
    repeatedParams.append("status", "active");
    repeatedParams.append("status", "inactive");
    const repeated = parseAdminListParams(repeatedParams);

    expect(unknown).toEqual({ query: "safe", page: 1, pageSize: 20 });
    expect(JSON.stringify(unknown)).not.toContain("super-secret-status");
    expect(repeated).toEqual({ page: 1, pageSize: 20 });
  });

  it("ignores unsafe, overlong, or repeated optional filters", () => {
    const params = new URLSearchParams({
      organizationId: "../../private",
      query: "x".repeat(101),
    });
    params.append("query", "second value");

    expect(parseAdminListParams(params)).toEqual({ page: 1, pageSize: 20 });
  });

  it("keeps the canonical schema strict and bounded", () => {
    expect(
      adminListParamsSchema.safeParse({
        page: 1,
        pageSize: 100,
        status: "processing",
      }).success,
    ).toBe(true);
    expect(
      adminListParamsSchema.safeParse({
        page: 1,
        pageSize: 101,
        status: "unknown",
      }).success,
    ).toBe(false);
  });
});
