import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { expect, it } from "vitest";
import { InformationPage } from "./InformationPage";
it("submits a demo support request with a local reference and no network", () => {
  render(
    <MemoryRouter initialEntries={["/support"]}>
      <InformationPage />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Email liên hệ"), {
    target: { value: "demo@example.invalid" },
  });
  fireEvent.change(screen.getByLabelText("Nội dung cần hỗ trợ"), {
    target: { value: "Tôi cần kiểm tra yêu cầu hoàn tiền của mình." },
  });
  fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
  expect(screen.getByRole("status")).toHaveTextContent("BLUE-SUP-");
});
it("privacy page describes demo storage and links to support", () => {
  render(
    <MemoryRouter initialEntries={["/privacy"]}>
      <InformationPage />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("heading", { level: 1, name: "Chính sách bảo mật" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Liên hệ hỗ trợ" })).toHaveAttribute(
    "href",
    "/support",
  );
});
