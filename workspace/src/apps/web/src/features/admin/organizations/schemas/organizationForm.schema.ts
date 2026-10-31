import { z } from "zod";

import type { OrganizationInput } from "@/features/admin/types/admin";

export const organizationFormSchema = z.object({
  name: z.string().trim().min(1, "Tên tổ chức là bắt buộc.").max(120),
  contactName: z.string().trim().max(120).optional(),
  legalName: z.string().trim().min(1, "Tên pháp lý là bắt buộc.").max(160),
  taxId: z.string().trim().min(1, "Mã số thuế là bắt buộc.").max(30),
  address: z.string().trim().min(1, "Địa chỉ là bắt buộc.").max(240),
  contactEmail: z.email("Email liên hệ không hợp lệ.").max(160),
  contactPhone: z
    .string()
    .trim()
    .regex(/^\d{10,15}$/, "Số điện thoại phải gồm 10–15 chữ số."),
  status: z.enum(["active", "inactive"]),
}) satisfies z.ZodType<OrganizationInput>;

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>;
