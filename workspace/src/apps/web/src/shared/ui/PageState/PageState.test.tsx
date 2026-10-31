import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageState } from "@/shared/ui/PageState/PageState";

describe("PageState", () => {
  it("renders without a recovery action when none is provided", () => {
    render(
      <PageState title="Chưa có dữ liệu" description="Hãy quay lại sau." />,
    );
    expect(
      screen.getByRole("region", { name: "Chưa có dữ liệu" }),
    ).toHaveAccessibleDescription("Hãy quay lại sau.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("PageState renders a labelled semantic section with description and recovery action", () => {
    render(
      <PageState
        action={<a href="/">Về trang chủ</a>}
        description="Trang bạn tìm hiện không có."
        title="Không tìm thấy trang"
      />,
    );

    const section = screen.getByRole("region", {
      name: "Không tìm thấy trang",
    });
    expect(
      within(section).getByRole("heading", {
        name: "Không tìm thấy trang",
        level: 1,
      }),
    ).toBeVisible();
    expect(section).toHaveAccessibleDescription("Trang bạn tìm hiện không có.");
    expect(
      within(section).getByRole("link", { name: "Về trang chủ" }),
    ).toHaveAttribute("href", "/");
  });
});
