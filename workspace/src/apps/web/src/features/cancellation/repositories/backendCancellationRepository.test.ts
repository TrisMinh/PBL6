import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("@/shared/api/client", () => ({ apiJson: vi.fn() }));
vi.mock("@/features/tickets/repositories/backendTicketRepository", () => ({
  ownedBooking: vi.fn(),
  hydrateBackendTicket: vi.fn(),
}));
import { apiJson } from "@/shared/api/client";
import { ownedBooking } from "@/features/tickets/repositories/backendTicketRepository";
import {
  backendCancellationRepository,
  getCancellationPreview,
} from "./backendCancellationRepository";
const access = { kind: "account" as const, token: "real-token" };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(ownedBooking).mockResolvedValue({
    id: "booking",
    code: "BK-REAL",
    rowVersion: 7,
  } as never);
});
describe("original cancellation live adapter", () => {
  it("submits the quote the customer reviewed rather than obtaining a different quote during confirmation", async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({
      previewId: "reviewed",
      ticketIds: ["ticket"],
      policyVersion: "v1",
      fee: 17500,
      refundAmount: 82500,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    await getCancellationPreview("booking", ["ticket"]);
    vi.mocked(apiJson)
      .mockResolvedValueOnce({
        operationId: "booking",
        status: "ACCEPTED",
        acceptedAt: "2026-11-16T10:00:00Z",
      })
      .mockResolvedValueOnce([{ id: "ticket", seatCode: "A01" }]);
    const receipt = await backendCancellationRepository.cancel(
      "booking",
      ["ticket"],
      "attempt",
      access,
    );
    expect(vi.mocked(apiJson).mock.calls[1]?.[2]).toMatchObject({
      body: { previewId: "reviewed", expectedVersion: 7 },
      idempotencyKey: "attempt",
    });
    expect(receipt).toMatchObject({
      status: "accepted",
      amountVnd: 82500,
      createdAt: "2026-11-16T10:00:00Z",
    });
  });
});
