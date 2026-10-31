import { describe, expect, it } from "vitest";

import { adminOrganizations, adminStaff } from "@/mocks/fixtures/admin";

describe("Task 8 Figma fixtures", () => {
  it("includes the organization represented by node 1185:760", () => {
    expect(adminOrganizations).toContainEqual(
      expect.objectContaining({
        id: "ORG-001",
        name: "BlueLine Co.",
        contactEmail: "contact@blueline.vn",
      }),
    );
  });

  it.each([
    ["USR-0018", "Nguyễn Hoàng Long"],
    ["USR-0019", "Trần Thu Hà"],
    ["USR-0021", "Hoàng Nam"],
    ["USR-0024", "Lê Minh Anh"],
    ["USR-0031", "Phạm Ngọc Mai"],
    ["USR-0032", "Lê Minh Khang"],
    ["USR-0033", "Võ Thành Đạt"],
    ["USR-0034", "Bùi Khánh Linh"],
    ["USR-0035", "Đỗ Minh Anh"],
    ["USR-0036", "Hoàng Quốc Bảo"],
    ["USR-0037", "Ngô Lan Chi"],
  ])("contains the independent record %s", (id, fullName) => {
    expect(adminStaff).toContainEqual(
      expect.objectContaining({ id, fullName }),
    );
  });
});
