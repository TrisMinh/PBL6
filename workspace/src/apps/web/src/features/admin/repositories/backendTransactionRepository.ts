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
import type { PagedResult } from "../types/pagination";

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
async function all(
  resource: string,
  signal?: AbortSignal,
  filters?: Record<string, string>,
): Promise<Row[]> {
  const items: Row[] = [];
  for (let page = 0; ; page++) {
    const query = new URLSearchParams({
      page: String(page),
      size: "100",
      ...filters,
    });
    const result = await liveApiJson(
      `/api/v1/admin/${resource}?${query}`,
      z.unknown(),
      { signal },
    );
    if (Array.isArray(result)) return array(result);
    const body = object(result);
    items.push(...array(body.items));
    if (page + 1 >= number(body.totalPages)) return items;
  }
}
function page<T>(
  items: T[],
  total: number,
  params: AdminListParams,
): PagedResult<T> {
  return {
    items,
    total,
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
  async function bookingReferences(
    body: { ids?: string[]; search?: string; organizationId?: string },
    signal?: AbortSignal,
  ): Promise<Map<string, string>> {
    const result = await liveApiJson(
      "/api/v1/admin/bookings/references",
      z.unknown(),
      { method: "POST", body, signal },
    );
    return new Map(array(result).map((row) => [text(row.id), text(row.code)]));
  }
  async function financePage(
    resource: "payments" | "refunds",
    params: AdminListParams,
    signal?: AbortSignal,
  ): Promise<{
    result: Row;
    codes: Map<string, string>;
    orgs: Map<string, string>;
  }> {
    const search = params.query?.trim();
    const raw =
      resource === "payments"
        ? [
            "PENDING",
            "PROCESSING",
            "SUCCEEDED",
            "FAILED",
            "CANCELLED",
            "REFUND_PENDING",
            "PARTIALLY_REFUNDED",
            "REFUNDED",
          ]
        : ["REQUESTED", "PROCESSING", "SUCCEEDED", "COMPLETED", "FAILED"];
    const statuses = params.status
      ? raw.filter(
          (status) =>
            liveTransactionStatus(resource, status).state === params.status,
        )
      : [];
    if (params.status && !statuses.length)
      return {
        result: {},
        codes: new Map<string, string>(),
        orgs: new Map<string, string>(),
      };
    const orgsRequest = organizations(signal);
    const resultRequest = (async () => {
      const matches = search
        ? await bookingReferences(
            { search, organizationId: params.organizationId },
            signal,
          )
        : new Map<string, string>();
      const result = object(
        await liveApiJson(
          `/api/v1/admin/${resource}?page=${params.page - 1}&size=${params.pageSize}`,
          z.unknown(),
          {
            method: "POST",
            signal,
            body: {
              search,
              statuses,
              organizationId: params.organizationId,
              matchingBookings: [...matches.keys()],
            },
          },
        ),
      );
      const missing = [
        ...new Set(
          array(result.items).map((row) =>
            text((resource === "refunds" ? object(row.refund) : row).bookingId),
          ),
        ),
      ].filter((id) => id && !matches.has(id));
      const codes = missing.length
        ? await bookingReferences({ ids: missing }, signal)
        : new Map<string, string>();
      for (const [id, code] of matches) codes.set(id, code);
      return { result, codes };
    })();
    const [orgs, result] = await Promise.all([orgsRequest, resultRequest]);
    return { orgs, ...result };
  }
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
        ...live(
          "refunds",
          value,
          text(value.organizationId) || text(linkedBooking.organizationId),
          orgs,
        ),
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
      const orgs = await organizations(signal);
      const query = new URLSearchParams({
        page: String(params.page - 1),
        size: String(params.pageSize),
      });
      if (params.organizationId)
        query.set("organizationId", params.organizationId);
      if (params.status) {
        const status =
          params.status === "awaiting-refund"
            ? "REFUND_PENDING"
            : params.status.replaceAll("-", "_").toUpperCase();
        query.set("status", status);
      }
      if (params.query) {
        query.set("search", params.query);
        const search = params.query.toLocaleLowerCase("vi");
        for (const [id, name] of orgs) {
          if (name.toLocaleLowerCase("vi").includes(search))
            query.append("matchingOrganizationId", id);
        }
      }
      const result = await get(`/api/v1/admin/bookings?${query}`, signal);
      return {
        items: array(result.items).map((value) => booking(value, orgs)),
        total: number(result.totalElements),
        page: params.page,
        pageSize: params.pageSize,
      };
    },
    getBooking: async (id, signal) => {
      const [value, orgs, payments, refunds, audit, tickets] =
        await Promise.all([
          get(`/api/v1/bookings/${id}`, signal),
          organizations(signal),
          liveApiJson(`/api/v1/bookings/${id}/payments`, z.unknown(), {
            signal,
          }).then(array),
          all("refunds", signal, { bookingId: id }),
          get(`/api/v1/admin/bookings/${id}/audit`, signal),
          liveApiJson(`/api/v1/bookings/${id}/tickets`, z.unknown(), {
            signal,
          }),
        ]);
      const trip = await get(`/api/v1/trips/${text(value.tripId)}`, signal);
      const result = booking(value, orgs, trip);
      const relatedPayments = payments,
        relatedRefunds = refunds;
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
      const { result, codes, orgs } = await financePage(
        "payments",
        params,
        signal,
      );
      return page(
        array(result.items).map((value) =>
          payment(value, orgs, { code: codes.get(text(value.bookingId)) }),
        ),
        number(result.totalElements),
        params,
      );
    },
    getPayment: async (id, signal) => {
      const [value, orgs, refunds, audit] = await Promise.all([
        get(`/api/v1/payments/${id}`, signal),
        organizations(signal),
        all("refunds", signal, { paymentId: id }),
        get(`/api/v1/admin/payments/${id}/audit`, signal),
      ]);
      const linkedBooking = await get(
        `/api/v1/bookings/${text(value.bookingId)}`,
        signal,
      );
      const result = payment(value, orgs, linkedBooking),
        relatedRefunds = refunds;
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
      const { result, codes, orgs } = await financePage(
        "refunds",
        params,
        signal,
      );
      return page(
        array(result.items).map((row) => {
          const value = object(row.refund);
          return refund(
            { ...value, organizationId: row.organizationId },
            orgs,
            { code: codes.get(text(value.bookingId)) },
            { paymentReference: row.paymentReference },
          );
        }),
        number(result.totalElements),
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
      result.transferReference = text(audit.transferReference) || undefined;
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
