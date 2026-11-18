import { z } from "zod";
import { liveApiJson } from "@/shared/api/liveRequest";
import { liveTransactionStatus } from "../transactions/liveTransactionStatus";
import type { AdminRepository } from "./adminRepository";
import type { AdminListParams } from "../schemas/adminListParams.schema";
import type {
  AdminBooking,
  AdminPayment,
  AdminRefund,
  LiveTransactionDetails,
} from "../types/admin";

type Row = Record<string, unknown>;
const text = (value: unknown): string =>
  typeof value === "string" ? value : "";
const number = (value: unknown): number =>
  typeof value === "number" ? value : 0;
const object = (value: unknown): Row =>
  value && typeof value === "object" ? (value as Row) : {};
const array = (value: unknown): Row[] =>
  Array.isArray(value) ? value.map(object) : [];
async function get(path: string, signal?: AbortSignal): Promise<Row> {
  return object(await liveApiJson(path, z.unknown(), { signal }));
}
async function all(resource: string, signal?: AbortSignal): Promise<Row[]> {
  const items: Row[] = [];
  for (let page = 0; ; page++) {
    const result = await liveApiJson(
      `/api/v1/admin/${resource}?page=${page}&size=100`,
      z.unknown(),
      { signal },
    );
    if (Array.isArray(result)) return array(result);
    const body = object(result);
    items.push(...array(body.items));
    if (page + 1 >= number(body.totalPages)) return items;
  }
}
function page<T extends { live?: LiveTransactionDetails }>(
  items: T[],
  params: AdminListParams,
): { items: T[]; page: number; pageSize: number; total: number } {
  const filtered = items.filter(
    (item) =>
      (!params.status || item.live?.state === params.status) &&
      (!params.organizationId ||
        item.live?.organizationId === params.organizationId) &&
      (!params.query ||
        JSON.stringify(item)
          .toLocaleLowerCase("vi")
          .includes(params.query.toLocaleLowerCase("vi"))),
  );
  return {
    items: filtered.slice(
      (params.page - 1) * params.pageSize,
      params.page * params.pageSize,
    ),
    total: filtered.length,
    page: params.page,
    pageSize: params.pageSize,
  };
}
function history(body: Row): LiveTransactionDetails["history"] {
  return array(body.history)
    .map((entry) => ({
      occurredAt: text(entry.occurredAt),
      description: text(entry.description),
    }))
    .filter((entry) => entry.occurredAt && entry.description)
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}
function refundReason(value: string): string {
  const reasons: Record<string, string> = {
    CUSTOMER_CANCELLATION: "Khách hủy vé",
    CUSTOMER_CANCEL: "Khách hủy vé",
    OPERATOR_CANCELLATION: "Nhà xe hủy chuyến",
    OPERATOR_CANCEL: "Nhà xe hủy chuyến",
    TRIP_CANCELLED: "Nhà xe hủy chuyến",
  };
  return reasons[value] ?? value;
}

function details(item: {
  live?: LiveTransactionDetails;
}): LiveTransactionDetails {
  if (!item.live) throw new Error("Transaction details unavailable");
  return item.live;
}

export function createBackendTransactionRepository(): Pick<
  AdminRepository,
  | "listBookings"
  | "getBooking"
  | "listPayments"
  | "getPayment"
  | "listRefunds"
  | "getRefund"
> {
  async function organizations(
    signal?: AbortSignal,
  ): Promise<Map<string, string>> {
    return new Map(
      array(
        await liveApiJson("/api/v1/admin/organizations", z.unknown(), {
          signal,
        }),
      ).map((org) => [text(org.id), text(org.name)]),
    );
  }
  function live(
    resource: "bookings" | "payments" | "refunds",
    value: Row,
    organizationId: string,
    orgs: Map<string, string>,
  ): LiveTransactionDetails {
    return {
      ...liveTransactionStatus(resource, text(value.status)),
      organizationId,
      organizationName: orgs.get(organizationId),
      history: [],
    };
  }
  function booking(
    value: Row,
    orgs: Map<string, string>,
    trip: Row = {},
  ): AdminBooking {
    return {
      id: text(value.id),
      bookingCode: text(value.code),
      organizationId: text(value.organizationId) || text(trip.organizationId),
      customerName: text(object(value.contact).fullName),
      routeLabel:
        trip.origin && trip.destination
          ? `${text(trip.origin)} → ${text(trip.destination)}`
          : "—",
      passengerCount: array(value.items).length,
      totalVnd: number(value.total),
      status: ["PAID", "COMPLETED", "CONFIRMED"].includes(text(value.status))
        ? "paid"
        : ["EXPIRED", "CANCELLED", "REFUNDED", "REFUND_PENDING"].includes(
              text(value.status),
            )
          ? "cancelled"
          : "pending-payment",
      createdAt: text(value.createdAt),
      updatedAt: text(value.updatedAt),
      live: {
        ...live(
          "bookings",
          value,
          text(value.organizationId) || text(trip.organizationId),
          orgs,
        ),
        departureAt: text(trip.departureAt),
        seats: array(value.items)
          .map((item) => text(item.seatCode))
          .filter(Boolean),
      },
    };
  }
  function payment(
    value: Row,
    orgs: Map<string, string>,
    linkedBooking: Row = {},
  ): AdminPayment {
    return {
      id: text(value.id),
      bookingId: text(value.bookingId),
      transactionCode: text(value.paymentReference),
      amountVnd: number(value.amount),
      status:
        value.status === "SUCCEEDED"
          ? "success"
          : value.status === "FAILED"
            ? "failed"
            : value.status === "CANCELLED"
              ? "cancelled"
              : "pending",
      createdAt: text(value.createdAt),
      updatedAt: text(value.updatedAt),
      live: {
        ...live(
          "payments",
          value,
          text(value.organizationId) || text(linkedBooking.organizationId),
          orgs,
        ),
        provider: text(value.provider),
        bookingCode: text(linkedBooking.code),
        partnerCode: text(value.providerTransactionId) || undefined,
      },
    };
  }
  function refund(
    value: Row,
    orgs: Map<string, string>,
    linkedBooking: Row = {},
    originalPayment: Row = {},
  ): AdminRefund {
    return {
      id: text(value.id),
      refundReference: text(value.refundReference) || undefined,
      bookingId: text(value.bookingId),
      paymentId: text(value.paymentId),
      amountVnd: number(value.amount),
      status:
        value.status === "SUCCEEDED"
          ? "completed"
          : value.status === "FAILED"
            ? "failed"
            : "processing",
      createdAt: text(value.createdAt),
      updatedAt: text(value.updatedAt),
      live: {
        ...live("refunds", value, text(linkedBooking.organizationId), orgs),
        reason: refundReason(text(value.reason)),
        bookingCode: text(linkedBooking.code),
        paymentCode: text(originalPayment.paymentReference),
      },
    };
  }
  const collected = (payments: Row[]): number =>
    payments
      .filter((item) =>
        [
          "SUCCEEDED",
          "REFUND_PENDING",
          "PARTIALLY_REFUNDED",
          "REFUNDED",
        ].includes(text(item.status)),
      )
      .reduce((sum, item) => sum + number(item.amount), 0);
  const refunded = (refunds: Row[]): number =>
    refunds
      .filter((item) => item.status === "SUCCEEDED")
      .reduce((sum, item) => sum + number(item.amount), 0);
  return {
    listBookings: async (params, signal) => {
      const [values, orgs] = await Promise.all([
        all("bookings", signal),
        organizations(signal),
      ]);
      // Lists need no trip request per record; trip and ticket details load on demand.
      return page(
        values.map((value) => booking(value, orgs)),
        params,
      );
    },
    getBooking: async (id, signal) => {
      const [value, orgs, payments, refunds, audit, tickets] =
        await Promise.all([
          get(`/api/v1/bookings/${id}`, signal),
          organizations(signal),
          all("payments", signal),
          all("refunds", signal),
          get(`/api/v1/admin/bookings/${id}/audit`, signal),
          liveApiJson(`/api/v1/bookings/${id}/tickets`, z.unknown(), {
            signal,
          }),
        ]);
      const trip = await get(`/api/v1/trips/${text(value.tripId)}`, signal);
      const result = booking(value, orgs, trip);
      const relatedPayments = payments.filter((item) => item.bookingId === id),
        relatedRefunds = refunds.filter((item) => item.bookingId === id);
      result.updatedAt = text(audit.updatedAt);
      result.live = {
        ...details(result),
        history: history(audit),
        seats: Array.isArray(audit.seats)
          ? audit.seats.filter(
              (seat): seat is string =>
                typeof seat === "string" && seat.length > 0,
            )
          : details(result).seats,
        paymentIds: relatedPayments.map((item) => text(item.id)),
        refundIds: relatedRefunds.map((item) => text(item.id)),
        paymentCodes: Object.fromEntries(
          relatedPayments.map((item) => [
            text(item.id),
            text(item.paymentReference),
          ]),
        ),
        refundCodes: Object.fromEntries(
          relatedRefunds.map((item) => [
            text(item.id),
            text(item.refundReference),
          ]),
        ),
        collectedVnd: collected(relatedPayments),
        refundedVnd: refunded(relatedRefunds),
        cancellationFee:
          typeof audit.cancellationFee === "number"
            ? audit.cancellationFee
            : undefined,
        expectedRefundVnd:
          typeof audit.refundAmount === "number"
            ? audit.refundAmount
            : undefined,
        ticketState: array(tickets).length
          ? [...new Set(array(tickets).map((item) => text(item.status)))].join(
              ", ",
            )
          : "Chưa phát hành",
      };
      return result;
    },
    listPayments: async (params, signal) => {
      const [values, orgs, bookings] = await Promise.all([
        all("payments", signal),
        organizations(signal),
        all("bookings", signal),
      ]);
      const byId = new Map(bookings.map((value) => [text(value.id), value]));
      return page(
        values.map((value) =>
          payment(value, orgs, byId.get(text(value.bookingId))),
        ),
        params,
      );
    },
    getPayment: async (id, signal) => {
      const [value, orgs, refunds, audit] = await Promise.all([
        get(`/api/v1/payments/${id}`, signal),
        organizations(signal),
        all("refunds", signal),
        get(`/api/v1/admin/payments/${id}/audit`, signal),
      ]);
      const linkedBooking = await get(
        `/api/v1/bookings/${text(value.bookingId)}`,
        signal,
      );
      const result = payment(value, orgs, linkedBooking),
        relatedRefunds = refunds.filter((item) => item.paymentId === id);
      result.updatedAt = text(audit.updatedAt);
      result.live = {
        ...details(result),
        partnerCode: text(audit.partnerCode) || result.live?.partnerCode,
        history: history(audit),
        refundIds: relatedRefunds.map((item) => text(item.id)),
        refundCodes: Object.fromEntries(
          relatedRefunds.map((item) => [
            text(item.id),
            text(item.refundReference),
          ]),
        ),
        collectedVnd: collected([value]),
        refundedVnd: refunded(relatedRefunds),
      };
      return result;
    },
    listRefunds: async (params, signal) => {
      const [values, orgs, bookings, payments] = await Promise.all([
        all("refunds", signal),
        organizations(signal),
        all("bookings", signal),
        all("payments", signal),
      ]);
      const byId = new Map(bookings.map((value) => [text(value.id), value]));
      const paymentById = new Map(
        payments.map((value) => [text(value.id), value]),
      );
      return page(
        values.map((value) =>
          refund(
            value,
            orgs,
            byId.get(text(value.bookingId)),
            paymentById.get(text(value.paymentId)),
          ),
        ),
        params,
      );
    },
    getRefund: async (id, signal) => {
      const [value, orgs, audit] = await Promise.all([
        get(`/api/v1/refunds/${id}`, signal),
        organizations(signal),
        get(`/api/v1/admin/refunds/${id}/audit`, signal),
      ]);
      const [linkedBooking, originalPayment, bookingAudit] = await Promise.all([
        get(`/api/v1/bookings/${text(value.bookingId)}`, signal),
        get(`/api/v1/payments/${text(value.paymentId)}`, signal),
        get(`/api/v1/admin/bookings/${text(value.bookingId)}/audit`, signal),
      ]);
      const result = refund(value, orgs, linkedBooking, originalPayment);
      result.updatedAt = text(audit.updatedAt);
      result.live = {
        ...details(result),
        provider: text(originalPayment.provider),
        partnerCode: text(audit.partnerCode) || undefined,
        history: history(audit),
        collectedVnd: collected([originalPayment]),
        refundedVnd: refunded([value]),
        cancellationFee:
          typeof bookingAudit.cancellationFee === "number"
            ? bookingAudit.cancellationFee
            : undefined,
        expectedRefundVnd:
          typeof bookingAudit.refundAmount === "number"
            ? bookingAudit.refundAmount
            : undefined,
      };
      return result;
    },
  };
}
