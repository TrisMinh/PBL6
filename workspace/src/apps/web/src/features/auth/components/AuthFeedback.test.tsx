import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/shared/api/config", () => ({ isMockApi: false }));
import { AuthError } from "./AuthFeedback";
import { BookingRepositoryError } from "@/features/booking/repositories/bookingRepositoryError";

afterEach(cleanup);
it("explains lockout without inventing a countdown or an exact unlock time", () => {
  render(<AuthError error={new BookingRepositoryError("HTTP_ERROR", 423)} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Tài khoản bị khóa");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Sai 5 lần: khóa 15 phút.",
  );
  expect(screen.queryByRole("timer")).not.toBeInTheDocument();
});
it("keeps ordinary invalid credentials as the generic login message", () => {
  const error = new BookingRepositoryError("INVALID_CREDENTIALS", 401);
  error.message = "Email/số điện thoại hoặc mật khẩu không đúng.";
  render(<AuthError error={error} />);
  expect(screen.getByRole("alert")).toHaveTextContent(error.message);
  expect(screen.queryByText("Tài khoản bị khóa")).not.toBeInTheDocument();
});
