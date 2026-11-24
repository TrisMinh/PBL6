import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ApiError } from "./error";
import { ApiFailure } from "./ResourcePage";

it("shows a safe popup without displaying server error content", () => {
  render(
    <ApiFailure
      popup
      error={
        new ApiError(
          "VALIDATION_ERROR",
          422,
          "sensitive-server-message",
          "internal-reference",
          {
            secret: "sensitive-details",
          },
        )
      }
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Thông tin chưa hợp lệ.");
  expect(document.body).not.toHaveTextContent(
    /sensitive-server-message|internal-reference|sensitive-details/,
  );
});
