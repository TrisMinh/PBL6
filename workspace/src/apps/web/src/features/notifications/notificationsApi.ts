import { z } from "zod";

import { apiJson } from "@/shared/api/client";

/** Mirrors NotificationDto / NotificationPageDto of the Notification service. */
export const notificationSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  referenceType: z.string().nullable().optional(),
  referenceId: z.string().nullable().optional(),
  read: z.boolean(),
  createdAt: z.string(),
});

export const notificationPageSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable().optional(),
});

export type NotificationItem = z.infer<typeof notificationSchema>;
export type NotificationPage = z.infer<typeof notificationPageSchema>;

export function listNotifications(
  signal?: AbortSignal,
  limit = 20,
  cursor?: string,
): Promise<NotificationPage> {
  return apiJson(
    `/api/v1/notifications?${new URLSearchParams({ limit: String(limit), ...(cursor ? { cursor } : {}) })}`,
    notificationPageSchema,
    { signal },
  );
}

export function markNotificationRead(
  notificationId: string,
): Promise<NotificationItem> {
  return apiJson(
    `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
    notificationSchema,
    { method: "PATCH" },
  );
}
