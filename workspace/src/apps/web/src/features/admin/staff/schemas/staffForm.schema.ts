import { z } from "zod";

import type { StaffInput } from "@/features/admin/types/admin";

export const staffFormSchema = z.object({
  organizationId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,128}$/, "Hãy chọn một tổ chức."),
  fullName: z.string().trim().min(1, "Tên nhân viên là bắt buộc.").max(120),
  email: z.email("Email không hợp lệ.").max(160),
  phone: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Số điện thoại phải gồm 10–15 chữ số."),
  status: z.enum(["active", "inactive"]),
}) satisfies z.ZodType<StaffInput>;

export type StaffFormValues = z.infer<typeof staffFormSchema>;
