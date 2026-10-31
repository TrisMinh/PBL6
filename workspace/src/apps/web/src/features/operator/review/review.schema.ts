import { z } from "zod";
export const REVIEW_DRAFT_KEY = "blue-operator-create-draft-v1";
export const reviewDraftSchema = z
  .object({
    origin: z.string().trim().min(1).max(100),
    destination: z.string().trim().min(1).max(100),
    date: z.iso.date(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    duration: z.number().positive().max(48),
    vehicle: z.string().min(1),
    driver: z.string().min(1),
    assistant: z.string(),
    fare: z.number().int().positive(),
    pickup: z.string().trim().min(1).max(1000),
    dropoff: z.string().trim().min(1).max(1000),
  })
  .strict()
  .refine((d) => d.origin !== d.destination, {
    message: "Điểm đi và điểm đến phải khác nhau.",
  });
export type ReviewDraft = z.infer<typeof reviewDraftSchema>;
export const reviewResultSchema = z.object({
  conflicts: z
    .array(
      z.object({
        title: z.string(),
        description: z.string(),
        detail: z.string(),
      }),
    )
    .default([]),
  eligible: z.boolean(),
  issues: z.array(z.string()),
  capacity: z.number().int().positive(),
  vehicleType: z.string(),
});
export type ReviewResult = z.infer<typeof reviewResultSchema>;
export const publishRequestSchema = z
  .object({ requestId: z.uuid(), draft: reviewDraftSchema })
  .strict();
export const publishResultSchema = z.object({
  id: z.string().regex(/^OP-[A-Z0-9-]+$/),
  status: z.literal("scheduled"),
});
export const REVIEW_SAMPLE: ReviewDraft = {
  origin: "TP.HCM",
  destination: "Đà Lạt",
  date: "2026-08-28",
  time: "07:30",
  duration: 7,
  vehicle: "51B-219.34",
  driver: "Quang Huy — GPLX hạng D",
  assistant: "Chưa phân công",
  fare: 320000,
  pickup: "Bến xe Miền Đông mới",
  dropoff: "Trung tâm Đà Lạt\nBến xe Liên tỉnh Đà Lạt",
};
