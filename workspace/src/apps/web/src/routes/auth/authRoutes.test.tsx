import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import LoginRoute, { meta as loginMeta } from "@/routes/auth/login";
import RegisterRoute, { meta as registerMeta } from "@/routes/auth/register";
import ForgotRoute, { meta as forgotMeta } from "@/routes/auth/forgot-password";

describe.each([
  [LoginRoute, loginMeta],
  [RegisterRoute, registerMeta],
  [ForgotRoute, forgotMeta],
])("auth thin route", (Page, meta) => {
  it("composes actual form and noindex metadata", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <Page />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByLabelText(/email/i)).toBeVisible();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(meta()).toContainEqual({
      name: "robots",
      content: "noindex, nofollow",
    });
  });
});
