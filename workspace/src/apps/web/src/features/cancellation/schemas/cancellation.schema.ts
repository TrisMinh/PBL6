import { z } from "zod";

import { paymentIdSchema } from "@/features/payment/schemas/payment.schema";
import {
  ticketCodeSchema,
  ticketDetailSchema,
} from "@/features/tickets/schemas/ticket.schema";

export const cancellationRequestSchema = z
  .object({
    ticketIds: z
      .array(paymentIdSchema)
      .min(1)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length)
      .readonly(),
  })
  .strict()
  .readonly();

export const cancellationKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._:-]{1,128}$/);

export const refundSchema = z
  .object({
    refundId: paymentIdSchema,
    bookingId: paymentIdSchema,
    bookingCode: ticketCodeSchema,
    ticketIds: z.array(paymentIdSchema).min(1).max(6).readonly(),
    seatCodes: z.array(z.string().min(1).max(12)).min(1).max(6).readonly(),
    amountVnd: z.number().int().positive(),
    referenceCode: z.string().regex(/^RF-[A-Z0-9-]+$/),
    status: z.literal("processing"),
    createdAt: z.iso.datetime(),
  })
  .strict()
  .refine((value) => new Set(value.ticketIds).size === value.ticketIds.length)
  .readonly();

export const cancellationOptionsSchema = z
  .object({
    bookingId: paymentIdSchema,
    bookingCode: ticketCodeSchema,
    tickets: z.array(ticketDetailSchema).max(6).readonly(),
    ticketPresentations: z
      .array(
        z
          .object({
            ticketId: paymentIdSchema,
            maskedPhone: z.string().min(8).max(20),
          })
          .strict()
          .readonly(),
      )
      .max(6)
      .readonly(),
    journey: z
      .object({
        operatorName: z.string().min(1),
        tripCode: z.string().min(1),
        departureTime: z.string().min(1),
        arrivalTime: z.string().min(1),
        originCity: z.string().min(1),
        originStop: z.string().min(1),
        destinationCity: z.string().min(1),
        destinationStop: z.string().min(1),
        durationLabel: z.string().min(1),
        serviceDateLabel: z.string().min(1),
        pickupTitle: z.string().min(1),
        pickupAddress: z.string().min(1),
        checkInLabel: z.string().min(1),
        requestedAtLabel: z.string().min(1),
        recordedAtLabel: z.string().min(1),
      })
      .strict()
      .readonly(),
    latestRefund: refundSchema.nullable(),
    refundRatePercent: z.literal(90),
    feeRatePercent: z.literal(10),
    policyLabel: z.literal("Mức 1 — Hủy trước 48 giờ"),
  })
  .strict()
  .refine((value) =>
    value.tickets.every(
      (ticket) =>
        ticket.bookingId === value.bookingId &&
        ticket.bookingCode === value.bookingCode,
    ),
  )
  .refine(
    (value) =>
      value.ticketPresentations.every((presentation) =>
        value.tickets.some(
          (ticket) => ticket.ticketId === presentation.ticketId,
        ),
      ) || value.tickets.length === 0,
  )
  .readonly();

export const cancellationKeyRecordSchema = z
  .object({
    key: cancellationKeySchema,
    bookingCode: ticketCodeSchema,
    ticketIds: z.array(paymentIdSchema).min(1).max(6).readonly(),
    refundId: paymentIdSchema,
  })
  .strict()
  .readonly();
