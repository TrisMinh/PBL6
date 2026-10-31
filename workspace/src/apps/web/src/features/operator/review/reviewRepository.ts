import { apiFetch as fetch } from "@/shared/api/client";
import {
  reviewDraftSchema,
  reviewResultSchema,
  publishResultSchema,
  REVIEW_DRAFT_KEY,
  type ReviewDraft,
  type ReviewResult,
} from "./review.schema";
const PENDING_CHECK_KEY = "blue-operator-pending-check-v1";
export function isDraftAwaitingCheck(draft: ReviewDraft): boolean {
  try {
    return sessionStorage.getItem(PENDING_CHECK_KEY) === JSON.stringify(draft);
  } catch {
    return true;
  }
}
export function markDraftAwaitingCheck(draft: ReviewDraft): void {
  sessionStorage.setItem(PENDING_CHECK_KEY, JSON.stringify(draft));
}
export async function loadReviewDraft(): Promise<ReviewDraft | null> {
  try {
    const raw = sessionStorage.getItem(REVIEW_DRAFT_KEY);
    if (!raw) return null;
    const parsed = reviewDraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function saveReviewDraft(draft: ReviewDraft): boolean {
  try {
    sessionStorage.setItem(
      REVIEW_DRAFT_KEY,
      JSON.stringify(reviewDraftSchema.parse(draft)),
    );
    return true;
  } catch {
    return false;
  }
}
export async function checkReview(
  draft: ReviewDraft,
  signal?: AbortSignal,
): Promise<ReviewResult> {
  const response = await fetch("/api/v1/operator/trip-review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reviewDraftSchema.parse(draft)),
    signal,
  });
  if (!response.ok)
    throw Error("Chưa kiểm tra được nguồn lực. Vui lòng thử lại.");
  const result = reviewResultSchema.parse(await response.json());
  try {
    if (isDraftAwaitingCheck(draft))
      sessionStorage.removeItem(PENDING_CHECK_KEY);
  } catch {
    /* The check remains valid when browser storage is unavailable. */
  }
  return result;
}
export async function publishReview(
  draft: ReviewDraft,
  requestId: string,
): Promise<string> {
  const response = await fetch("/api/v1/operator/trip-publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft: reviewDraftSchema.parse(draft), requestId }),
  });
  if (!response.ok)
    throw Error(
      response.status === 409
        ? "Nguồn lực đã thay đổi hoặc trùng lịch. Kiểm tra lại trước khi phát hành."
        : "Chưa phát hành được chuyến. Bạn có thể thử lại.",
    );
  return publishResultSchema.parse(await response.json()).id;
}
