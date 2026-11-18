import { describe, expect, it } from "vitest";
import { ApiError } from "@/shared/api/error";
import { transactionErrorState } from "./transactionErrorState";

describe("live transaction failures", () => {
  it.each([
    [403, "forbidden"],
    [404, "not-found"],
    [400, "invalid"],
    [429, "error"],
    [500, "error"],
    [0, "error"],
  ] as const)("maps HTTP %s to %s", (status, state) => {
    expect(
      transactionErrorState(new ApiError("HTTP_ERROR", status, "Failure")),
    ).toBe(state);
  });
});
