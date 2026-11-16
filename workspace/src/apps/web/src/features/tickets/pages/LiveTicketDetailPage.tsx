import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { apiJson } from "@/shared/api/client";
import { backendTicketSchema, bookingSchema } from "@/shared/api/contracts";
import { readApiSession } from "@/shared/api/session";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { stateLabel } from "@/shared/api/livePresentation";
import {
  getBackendTrip,
  toTrip,
} from "@/features/trips/repositories/backendTripRepository";
import { TicketCard } from "../components/TicketCard/TicketCard";
import type { TicketDetail } from "../types/ticketAccess";
import { z } from "zod";
import "../components/TicketCard/TicketCard.css";
import "./TicketPage.css";

export function LiveTicketDetailPage(): ReactElement {
  const { ticketCode = "" } = useParams();
  const session = readApiSession();
  const valid = z.string().uuid().safeParse(ticketCode).success;
  const query = useQuery({
    queryKey: liveQueryKey("ticket-detail", ticketCode),
    enabled: !!session && valid,
    queryFn: async ({ signal }) => {
      const ticket = await apiJson(
        `/api/v1/tickets/${ticketCode}`,
        backendTicketSchema,
        { signal },
      );
      const [booking, trip] = await Promise.all([
        apiJson(`/api/v1/bookings/${ticket.bookingId}`, bookingSchema, {
          signal,
        }),
        getBackendTrip(ticket.tripId, signal),
      ]);
      return { ticket, booking, trip };
    },
    retry: false,
    refetchOnWindowFocus: true,
  });
  const qr = useQuery({
    queryKey: liveQueryKey(
      "ticket-qr",
      ticketCode,
      query.data?.ticket.rowVersion,
    ),
    enabled:
      query.data?.ticket.status === "ISSUED" && !!query.data.ticket.qrPayload,
    queryFn: async () => {
      const payload = query.data?.ticket.qrPayload;
      if (!payload) throw new Error("Chưa có mã QR của vé.");
      const { toDataURL } = await import("qrcode");
      return toDataURL(payload, {
        width: 230,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#10243e", light: "#ffffff" },
      });
    },
    staleTime: Infinity,
    retry: false,
  });
  if (!valid)
    return (
      <section className="ticket-page">
        <h1>Vé điện tử</h1>
        <p role="alert">Mã vé trong đường dẫn không hợp lệ.</p>
        <Link to="/account/tickets">Vé của tôi</Link>
      </section>
    );
  if (!session)
    return (
      <section className="ticket-page">
        <h1>Vé điện tử</h1>
        <p>Đăng nhập tài khoản sở hữu vé để xem thông tin.</p>
        <Link to="/login" state={{ from: `/tickets/${ticketCode}` }}>
          Đăng nhập
        </Link>
      </section>
    );
  if (query.isPending)
    return (
      <section className="ticket-page">
        <p role="status">Đang tải vé điện tử…</p>
      </section>
    );
  if (query.isError)
    return (
      <section className="ticket-page">
        <h1>Vé điện tử</h1>
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      </section>
    );
  const { ticket, booking, trip } = query.data;
  const presentation = toTrip(trip);
  const mapped: TicketDetail = {
    ticketId: ticket.id,
    ticketCode: ticket.publicCode,
    bookingId: ticket.bookingId,
    tripId: ticket.tripId,
    seatId:
      booking.items.find((item) => item.fullName === ticket.passengerName)
        ?.seatId ?? ticket.id,
    seatCode: ticket.seatCode,
    fareVnd: Math.round(
      (booking.subtotal ?? booking.total) / Math.max(1, booking.items.length),
    ),
    status:
      ticket.status === "ISSUED" || ticket.status === "CHECKED_IN"
        ? "issued"
        : "cancelled",
    bookingCode: booking.code,
    transactionId: ticket.bookingId,
    issuedAt: new Date(ticket.issuedAt).toISOString(),
    passenger: { fullName: ticket.passengerName },
    trip: {
      ...presentation,
      amenities: [...presentation.amenities],
      stops: presentation.stops ? [...presentation.stops] : undefined,
      departureTime: new Date(trip.departureAt).toISOString(),
      arrivalTime: new Date(trip.arrivalAt).toISOString(),
    },
  };
  return (
    <section className="ticket-page">
      <header className="ticket-page__heading">
        <h1>Vé điện tử</h1>
        <Link to="/account/tickets">← Vé của tôi</Link>
      </header>
      <TicketCard
        ticket={mapped}
        ticketCodes={[ticket.publicCode]}
        live={{
          qrUrl: qr.data,
          cancelHref: `/bookings/${booking.id}/cancel`,
          canCancel: ticket.status === "ISSUED",
          statusLabel: stateLabel(ticket.status),
        }}
      />
    </section>
  );
}
