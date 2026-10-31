import { z } from "zod";

import {
  cancellationKeyRecordSchema,
  refundSchema,
} from "@/features/cancellation/schemas/cancellation.schema";
import type { MockDb } from "@/mocks/state/mockDb";
import type { Ticket } from "@/features/tickets/types/ticket";

export const cancellationArchiveShape = {
  refunds: z.array(refundSchema).max(100).default([]),
  cancellationKeys: z.array(cancellationKeyRecordSchema).max(100).default([]),
};
export type CancellationArchive = z.infer<
  z.ZodObject<typeof cancellationArchiveShape>
>;

export function collectCancellationArchive(db: MockDb): CancellationArchive {
  return {
    refunds: [...db.refunds.values()],
    cancellationKeys: [...db.cancellationKeys.values()],
  };
}

export function validCancellationArchive(
  archive: CancellationArchive,
  tickets: readonly Ticket[],
): boolean {
  const refundIds = archive.refunds.map((refund) => refund.refundId);
  const keys = archive.cancellationKeys.map((record) => record.key);
  const linkedRefundIds = archive.cancellationKeys.map(
    (record) => record.refundId,
  );
  return (
    new Set(refundIds).size === refundIds.length &&
    new Set(keys).size === keys.length &&
    new Set(linkedRefundIds).size === linkedRefundIds.length &&
    linkedRefundIds.length === refundIds.length &&
    refundIds.every((id) => linkedRefundIds.includes(id)) &&
    archive.cancellationKeys.every((record) => {
      const refund = archive.refunds.find(
        (item) => item.refundId === record.refundId,
      );
      return Boolean(
        refund &&
        refund.bookingCode === record.bookingCode &&
        JSON.stringify(refund.ticketIds) === JSON.stringify(record.ticketIds),
      );
    }) &&
    archive.refunds.every(
      (refund) =>
        refund.ticketIds.every(
          (id) =>
            tickets.find((ticket) => ticket.ticketId === id)?.status ===
            "cancelled",
        ) &&
        refund.amountVnd ===
          Math.round(
            refund.ticketIds.reduce(
              (total, id) =>
                total +
                (tickets.find((ticket) => ticket.ticketId === id)?.fareVnd ??
                  0),
              0,
            ) * 0.9,
          ),
    )
  );
}

export function restoreCancellationArchive(
  db: MockDb,
  archive: CancellationArchive,
): void {
  db.refunds = new Map(archive.refunds.map((item) => [item.refundId, item]));
  db.cancellationKeys = new Map(
    archive.cancellationKeys.map((item) => [item.key, item]),
  );
}
