import { describe, it, expect } from "vitest";
import {
  REVIEW_SAMPLE,
  reviewDraftSchema,
  reviewResultSchema,
  publishResultSchema,
} from "./review.schema";
async function post(path: string, body: unknown): Promise<Response> {
  return fetch(new URL(`/api/v1/operator/${path}`, window.location.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("Operator review and publication", () => {
  it("rejects an invalid route and non-integer fare", () => {
    expect(
      reviewDraftSchema.safeParse({
        ...REVIEW_SAMPLE,
        destination: REVIEW_SAMPLE.origin,
      }).success,
    ).toBe(false);
    expect(
      reviewDraftSchema.safeParse({ ...REVIEW_SAMPLE, fare: 1.5 }).success,
    ).toBe(false);
  });
  it("detects actual overlap and licence expiry in mock resources", async () => {
    const overlap = await post("trip-review", {
      ...REVIEW_SAMPLE,
      vehicle: "45B-204.12",
      driver: "Hoàng Nam — GPLX hạng D",
    });
    const result = reviewResultSchema.parse(await overlap.json());
    expect(result.eligible).toBe(false);
    expect(result.conflicts).toHaveLength(result.issues.length);
    expect(result.conflicts.map((c) => c.title)).toEqual([
      "Xe bị trùng lịch",
      "Tài xế bị trùng lịch",
      "Giấy phép lái xe hết hạn",
    ]);
    expect(result.conflicts[0].description).toContain("45B-204.12");
    expect(result.conflicts[0].description).toContain("BL-204");
    expect(result.conflicts[2].description).toContain("20/08/2026");
    expect(result.issues.join(" ")).toContain("BL-204");
    const expired = await post("trip-review", {
      ...REVIEW_SAMPLE,
      date: "2031-01-01",
    });
    expect(reviewResultSchema.parse(await expired.json()).eligible).toBe(false);
  });
  it("publishes once per attempt and rejects a second overlapping booking", async () => {
    const draft = { ...REVIEW_SAMPLE, date: "2029-02-01" };
    const requestId = crypto.randomUUID();
    const first = await post("trip-publish", { requestId, draft });
    expect(first.status).toBe(201);
    const receipt = publishResultSchema.parse(await first.json());
    const replay = await post("trip-publish", { requestId, draft });
    expect(replay.status).toBe(200);
    expect(publishResultSchema.parse(await replay.json()).id).toBe(receipt.id);
    const conflicting = await post("trip-publish", {
      requestId: crypto.randomUUID(),
      draft,
    });
    expect(conflicting.status).toBe(409);
  });
});
