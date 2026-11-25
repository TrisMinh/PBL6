import { createRef } from "react";
import { render, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { EmbeddedPowerBI } from "./EmbeddedPowerBI";

const sdk = vi.hoisted(() => ({
  embed: vi.fn(),
  reset: vi.fn(),
  on: vi.fn(),
  setComponentTitle: vi.fn(),
  setAccessToken: vi.fn(async () => undefined),
}));

vi.mock("powerbi-client", () => ({
  service: {
    Service: class {
      embed = sdk.embed;
      reset = sdk.reset;
    },
  },
  factories: {},
  models: { TokenType: { Embed: 1 }, Permissions: { Read: 0 }, ViewMode: { View: 0 } },
}));

it("loads a read-only report, renews its token in place, and removes it on close", async () => {
  sdk.embed.mockReturnValue(sdk);
  const frame = createRef<HTMLDivElement>();
  const session = {
    reportId: "98644327-fe92-489c-a4c9-adfd9b0a02fd",
    embedUrl: "https://app.powerbi.com/reportEmbed",
    token: "first-token",
    expiration: "2026-11-25T12:00:00Z",
  };
  const screen = render(<EmbeddedPowerBI session={session} frameRef={frame} />);
  await waitFor(() => expect(sdk.embed).toHaveBeenCalledWith(expect.any(HTMLDivElement),
    expect.objectContaining({ id: session.reportId, accessToken: session.token, tokenType: 1, permissions: 0 })));
  screen.rerender(<EmbeddedPowerBI session={{ ...session, token: "next-token" }} frameRef={frame} />);
  await waitFor(() => expect(sdk.setAccessToken).toHaveBeenCalledWith("next-token"));
  expect(sdk.embed).toHaveBeenCalledTimes(1);
  screen.unmount();
  expect(sdk.reset).toHaveBeenCalledOnce();
});
