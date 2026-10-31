import { z } from "zod";
import {
  bookingAuditSchema,
  paymentAuditSchema,
  refundAuditSchema,
} from "@/features/admin/transactions/transactionAudit.schema";

import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
  Organization,
  OrganizationInput,
  Staff,
  StaffInput,
  Membership,
  MembershipInput,
} from "@/features/admin/types/admin";
import type { PagedResult } from "@/features/admin/types/pagination";

export const adminIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const timestampSchema = z.iso.datetime();
const moneySchema = z.number().int().nonnegative();
const statusSchema = z.enum(["active", "inactive"]);

export const membershipInputSchema = z
  .object({
    staffId: adminIdSchema,
    organizationId: adminIdSchema,
    role: z.enum(["OPERATOR_ADMIN", "OPERATOR_SCHEDULER", "DRIVER"]),
    status: statusSchema,
    reason: z.string().trim().min(1).max(500),
  })
  .strict() satisfies z.ZodType<MembershipInput>;
export const membershipSchema: z.ZodType<Membership> = membershipInputSchema
  .extend({ memberSince: z.iso.date() })
  .strict();

export const organizationInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    contactName: z.string().trim().max(120).optional(),
    legalName: z.string().trim().max(160).optional(),
    taxId: z.string().trim().max(30).optional(),
    address: z.string().trim().max(240).optional(),
    contactEmail: z.email().max(160),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/),
    status: statusSchema,
  })
  .strict() satisfies z.ZodType<OrganizationInput>;

export const staffInputSchema = z
  .object({
    organizationId: adminIdSchema,
    fullName: z.string().trim().min(1).max(120),
    email: z.email().max(160),
    phone: z
      .string()
      .trim()
      .regex(/^\d{10,15}$/),
    status: statusSchema,
    role: z
      .enum([
        "OPERATOR_ADMIN",
        "OPERATOR_SCHEDULER",
        "DRIVER",
        "PLATFORM_SUPPORT",
      ])
      .optional(),
    membershipReason: z.string().trim().max(500).optional(),
  })
  .strict() satisfies z.ZodType<StaffInput>;

export const organizationSchema: z.ZodType<Organization> = z
  .object({
    id: adminIdSchema,
    ...organizationInputSchema.shape,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const staffSchema: z.ZodType<Staff> = z
  .object({
    id: adminIdSchema,
    ...staffInputSchema.shape,
    displayEmail: z.string().max(160).optional(),
    displayPhone: z.string().max(40).optional(),
    memberSince: z.iso.date().optional(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const adminBookingSchema: z.ZodType<AdminBooking> = z
  .object({
    audit: bookingAuditSchema.optional(),
    id: adminIdSchema,
    bookingCode: z.string().min(1).max(128),
    organizationId: adminIdSchema,
    customerName: z.string().min(1).max(160),
    routeLabel: z.string().min(1).max(240),
    passengerCount: z.number().int().min(1).max(6),
    totalVnd: moneySchema,
    status: z.enum(["pending-payment", "paid", "cancelled"]),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const adminPaymentSchema: z.ZodType<AdminPayment> = z
  .object({
    audit: paymentAuditSchema.optional(),
    id: adminIdSchema,
    bookingId: adminIdSchema,
    transactionCode: z.string().min(1).max(128),
    amountVnd: moneySchema,
    status: z.enum(["pending", "success", "failed", "cancelled"]),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const adminRefundSchema: z.ZodType<AdminRefund> = z
  .object({
    audit: refundAuditSchema.optional(),
    id: adminIdSchema,
    bookingId: adminIdSchema,
    paymentId: adminIdSchema,
    amountVnd: moneySchema,
    status: z.enum(["processing", "completed", "failed"]),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export function pagedResultSchema<T>(
  itemSchema: z.ZodType<T>,
): z.ZodType<PagedResult<T>> {
  return z
    .object({
      items: z.array(itemSchema),
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100),
      total: z.number().int().nonnegative(),
    })
    .strict()
    .refine(
      (result) =>
        result.items.length <= result.pageSize &&
        result.items.length <= result.total,
      { path: ["items"] },
    );
}
