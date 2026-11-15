import { useState, type ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { apiJson } from "@/shared/api/client";
import { backendTicketSchema, bookingSchema } from "@/shared/api/contracts";
import { readApiSession } from "@/shared/api/session";
import { liveQueryKey } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { stateLabel } from "@/shared/api/livePresentation";
import { getBackendTrip } from "@/features/trips/repositories/backendTripRepository";
import { Button } from "@/shared/ui/Button/Button";
import { z } from "zod";
import perforation from "@/assets/tickets/ticket-perforation.svg";
import timeline from "@/assets/tickets/ticket-timeline.svg";
import ready from "@/assets/tickets/ticket-ready.svg";
import "../components/TicketCard/TicketCard.css";
import "./TicketPage.css";
import "./LiveTicketDetailPage.css";

const clock = (value: string): string =>
  new Date(value).toLocaleTimeString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });

export function LiveTicketDetailPage(): ReactElement {
  const { ticketCode = "" } = useParams();
  const session = readApiSession();
  const valid = z.string().uuid().safeParse(ticketCode).success;
  const [notice, setNotice] = useState("");
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
  const issued = ticket.status === "ISSUED";
  const matching = booking.items.filter(
    (item) => item.fullName === ticket.passengerName,
  );
  const pickupIds = [
    ...new Set(booking.items.map((item) => item.pickupStopId)),
  ];
  const dropoffIds = [
    ...new Set(booking.items.map((item) => item.dropoffStopId)),
  ];
  const pickup = trip.stops.find(
    (stop) =>
      stop.id ===
      (matching.length === 1
        ? matching[0].pickupStopId
        : pickupIds.length === 1
          ? pickupIds[0]
          : undefined),
  );
  const dropoff = trip.stops.find(
    (stop) =>
      stop.id ===
      (matching.length === 1
        ? matching[0].dropoffStopId
        : dropoffIds.length === 1
          ? dropoffIds[0]
          : undefined),
  );
  const minutes = Math.round(
    (Date.parse(trip.arrivalAt) - Date.parse(trip.departureAt)) / 60000,
  );
  const share = async (): Promise<void> => {
    try {
      if (navigator.share)
        await navigator.share({
          title: `Vé ${ticket.publicCode}`,
          url: window.location.href,
        });
      else {
        await navigator.clipboard.writeText(window.location.href);
        setNotice(
          "Đã sao chép liên kết vé. Người nhận cần đăng nhập đúng tài khoản để xem.",
        );
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setNotice(
          "Không thể chia sẻ tự động. Bạn có thể sao chép đường dẫn trên thanh địa chỉ.",
        );
    }
  };
  return (
    <section className="ticket-page live-ticket" data-status={ticket.status}>
      <header className="ticket-page__heading">
        <nav className="ticket-page__breadcrumb" aria-label="Đường dẫn">
          <Link to="/account/tickets">Hành trình của tôi</Link>
          <span>/</span>
          <span>Vé điện tử</span>
        </nav>
        <h1>Vé điện tử</h1>
      </header>
      <article className="ticket-card" aria-label="Thông tin vé điện tử">
        <header className="ticket-card__header">
          <div className="ticket-card__brand">
            <strong className="live-ticket__brand">BLUE</strong>
            <span className="live-ticket__state">
              {issued ? "ĐÃ PHÁT HÀNH" : stateLabel(ticket.status)}
            </span>
            <small>ĐƠN {booking.code}</small>
          </div>
          <h2>
            {trip.origin} → {trip.destination}
          </h2>
          <p>
            {new Date(trip.departureAt).toLocaleDateString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              weekday: "long",
            })}
            ,{" "}
            {new Date(trip.departureAt).toLocaleDateString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}{" "}
            · Khởi hành {clock(trip.departureAt)}
          </p>
        </header>
        <div className="ticket-card__body">
          <div className="ticket-card__content">
            <section className="ticket-card__journey" aria-label="Lộ trình">
              <h3>LỘ TRÌNH</h3>
              <div className="ticket-card__schedule">
                <div>
                  <time>{clock(trip.departureAt)}</time>
                  <p>{pickup?.name ?? trip.origin}</p>
                </div>
                <div className="ticket-card__timeline">
                  <small>
                    {Math.floor(minutes / 60)} giờ {minutes % 60 || ""}
                  </small>
                  <img src={timeline} alt="" width={290} height={34} />
                </div>
                <div>
                  <time>{clock(trip.arrivalAt)}</time>
                  <p>{dropoff?.name ?? trip.destination}</p>
                </div>
              </div>
            </section>
            <dl className="ticket-card__facts">
              {[
                ["NHÀ XE KHAI THÁC", trip.operatorName],
                ["GHẾ", ticket.seatCode],
                ["HÀNH KHÁCH", ticket.passengerName],
                ["ĐIỂM ĐÓN", pickup?.name ?? "Xem thông tin trong đơn đặt vé"],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="ticket-card__notice">
              <img src={ready} alt="" width={22} height={22} />
              <span>
                <strong>
                  {issued && ticket.qrPayload
                    ? "Sẵn sàng để quét"
                    : stateLabel(ticket.status)}
                </strong>
                {issued
                  ? "Vui lòng có mặt sớm và chuẩn bị giấy tờ cần thiết."
                  : "Mã QR không còn hiệu lực để lên xe khi vé đã hủy hoặc đã sử dụng."}
              </span>
            </div>
            <p className="ticket-card__policy">
              QR chỉ hợp lệ khi vé ở trạng thái Đã phát hành. Hủy vé và hoàn
              tiền được xử lý theo chính sách riêng.
            </p>
          </div>
          <aside
            className="ticket-card__stub"
            aria-label="Mã QR và thao tác vé"
          >
            <img
              className="ticket-card__perforation"
              src={perforation}
              alt=""
              width={2}
              height={455}
            />
            <figure className="ticket-card__marker">
              <span>QUÉT KHI LÊN XE</span>
              {issued && ticket.qrPayload ? (
                qr.data ? (
                  <img
                    src={qr.data}
                    alt={`Mã QR vé ${ticket.publicCode}`}
                    width={230}
                    height={230}
                  />
                ) : qr.isError ? (
                  <p role="alert">
                    Không tạo được QR. Vui lòng đọc mã vé cho nhân viên.
                  </p>
                ) : (
                  <p role="status">Đang tạo mã QR…</p>
                )
              ) : (
                <p>Mã QR không khả dụng cho trạng thái vé này.</p>
              )}
            </figure>
            <strong className="ticket-card__code">{ticket.publicCode}</strong>
            <p>Nếu QR không quét được, đọc mã vé cho nhân viên.</p>
            <div className="live-ticket__actions">
              <Button onClick={() => window.print()}>Tải vé PDF</Button>
              <Button variant="secondary" onClick={() => void share()}>
                Chia sẻ
              </Button>
            </div>
            <small>Phát hành lúc {clock(ticket.issuedAt)}</small>
          </aside>
        </div>
      </article>
      {notice && <p role="status">{notice}</p>}
      <nav className="live-ticket__navigation">
        <Link to="/account/tickets">← Vé của tôi</Link>
        {issued && (
          <Link to={`/bookings/${booking.id}/cancel`}>
            Xem chính sách hủy vé
          </Link>
        )}
      </nav>
    </section>
  );
}
