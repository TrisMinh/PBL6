import type { ReactElement } from "react";
import { Link } from "react-router";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { Prohibit } from "@phosphor-icons/react/dist/csr/Prohibit";

import ticketPerforation from "@/assets/tickets/ticket-perforation.svg";
import ticketQr from "@/assets/tickets/ticket-qr.png";
import ticketTimeline from "@/assets/tickets/ticket-timeline.svg";
import type { TicketDetail } from "@/features/tickets/types/ticketAccess";
import {
  ROUTES,
  bookingCancellationPath,
  ticketPath,
} from "@/shared/config/routes";
import { formatDateTime } from "@/shared/lib/formatDateTime";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { StatusBadge } from "@/shared/ui/StatusBadge/StatusBadge";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

import "./TicketCard.css";

interface Props {
  ticket: TicketDetail;
  ticketCodes: readonly string[];
  live?: {
    qrUrl?: string;
    cancelHref: string;
    canCancel: boolean;
    statusLabel: string;
  };
}
function TicketHeader({
  ticket,
  live,
}: Pick<Props, "ticket" | "live">): ReactElement {
  return (
    <header className="ticket-card__header">
      <div className="ticket-card__brand">
        <BrandLogo placement="header" className="ticket-card__brand-logo" />
        <StatusBadge tone={ticket.status === "issued" ? "success" : "error"}>
          {live?.statusLabel ??
            (ticket.status === "issued" ? "Đã phát hành" : "Đã hủy")}
        </StatusBadge>
        <span>
          Mã đặt vé <strong>{ticket.bookingCode}</strong>
        </span>
      </div>
      <h2>
        {ticket.trip.origin.displayName} → {ticket.trip.destination.displayName}
      </h2>
      <p>{formatDateTime(ticket.trip.departureTime, "EEEE, dd MMMM yyyy")}</p>
    </header>
  );
}
function TicketJourney({ ticket }: { ticket: TicketDetail }): ReactElement {
  return (
    <section className="ticket-card__journey" aria-label="Lộ trình">
      <h3>LỘ TRÌNH</h3>
      <div className="ticket-card__schedule">
        <div>
          <time dateTime={ticket.trip.departureTime}>
            {formatDateTime(ticket.trip.departureTime)}
          </time>
          <p>{ticket.trip.originStopName || ticket.trip.origin.name}</p>
          <span>{formatDateTime(ticket.trip.departureTime, "dd/MM/yyyy")}</span>
        </div>
        <div className="ticket-card__timeline" aria-hidden="true">
          <img src={ticketTimeline} alt="" />
        </div>
        <div>
          <time dateTime={ticket.trip.arrivalTime}>
            {formatDateTime(ticket.trip.arrivalTime)}
          </time>
          <p>
            {ticket.trip.destinationStopName || ticket.trip.destination.name}
          </p>
          <span>{formatDateTime(ticket.trip.arrivalTime, "dd/MM/yyyy")}</span>
        </div>
      </div>
    </section>
  );
}
function TicketFacts({ ticket }: { ticket: TicketDetail }): ReactElement {
  const facts = [
    ["Nhà xe khai thác", ticket.trip.operator.name],
    ["Ghế", ticket.seatCode],
    ["Hành khách", ticket.passenger.fullName],
    ["Giá vé", formatCurrencyVnd(ticket.fareVnd)],
    ["Điểm đón", ticket.trip.originStopName || ticket.trip.origin.name],
    [
      "Điểm trả",
      ticket.trip.destinationStopName || ticket.trip.destination.name,
    ],
  ];
  return (
    <dl className="ticket-card__facts">
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function TicketStub({
  ticket,
  live,
}: Pick<Props, "ticket" | "live">): ReactElement {
  return (
    <aside className="ticket-card__stub" aria-label="Mã vé và điều hướng">
      <img
        className="ticket-card__perforation"
        src={ticketPerforation}
        alt=""
        aria-hidden="true"
      />
      <figure className="ticket-card__marker">
        <span>MÃ VÉ ĐIỆN TỬ</span>
        {ticket.status === "issued" && (!live || live.qrUrl) ? (
          <img
            src={live ? live.qrUrl : ticketQr}
            alt={
              live
                ? `Mã QR vé ${ticket.ticketCode}`
                : "Mã vé minh họa, không dùng để quét"
            }
            data-presentation-only={live ? undefined : "true"}
          />
        ) : (
          <div className="ticket-card__inactive">
            {ticket.status === "issued" ? (
              <span role="status">
                {live?.statusLabel === "Đã lên xe"
                  ? "Đã lên xe"
                  : "Đang tải mã vé…"}
              </span>
            ) : (
              <Prohibit size={38} weight="duotone" aria-hidden />
            )}
          </div>
        )}
        <figcaption>
          {ticket.status === "issued"
            ? live
              ? "Xuất trình mã vé khi lên xe"
              : "Minh họa mã vé — không dùng để quét"
            : "Vé đã hủy — mã vé không còn hiệu lực"}
        </figcaption>
      </figure>
      <strong className="ticket-card__code">{ticket.ticketCode}</strong>
    </aside>
  );
}

function TicketActions({ ticket, ticketCodes, live }: Props): ReactElement {
  return (
    <nav className="ticket-card__links" aria-label="Thao tác với vé">
      {ticketCodes
        .filter((code) => code !== ticket.ticketCode)
        .map((code) => (
          <Link key={code} to={ticketPath(code)}>
            Xem vé {code}
          </Link>
        ))}
      <Link className="ticket-card__lookup-action" to={ROUTES.ticketLookup}>
        Tra cứu vé khác
      </Link>
      {ticket.status === "issued" && (!live || live.canCancel) ? (
        <Link
          className="ticket-card__cancel-action"
          to={live?.cancelHref ?? bookingCancellationPath(ticket.bookingCode)}
        >
          Hủy vé
        </Link>
      ) : null}
    </nav>
  );
}
export function TicketCard(props: Props): ReactElement {
  return (
    <article
      className="ticket-card ticket-card--mock"
      data-status={props.ticket.status}
      aria-label={
        props.ticket.status === "issued" ? "Vé đã phát hành" : "Vé đã hủy"
      }
    >
      <TicketHeader ticket={props.ticket} live={props.live} />
      <div className="ticket-card__body">
        <div className="ticket-card__content">
          <TicketJourney ticket={props.ticket} />
          <TicketFacts ticket={props.ticket} />
          {props.ticket.status === "issued" ? (
            <p className="ticket-card__boarding-tip">
              <Info size={15} aria-hidden />
              <span>Nên đến điểm đón sớm và mang giấy tờ cần thiết.</span>
            </p>
          ) : (
            <p className="ticket-card__notice">
              <Prohibit size={22} aria-hidden />
              <span>
                <strong>Vé đã hủy</strong>Vé này không còn hiệu lực cho chuyến
                đi.
              </span>
            </p>
          )}
          <p className="ticket-card__policy">
            {props.live
              ? "Thông tin vé được xác thực từ hệ thống BLUE."
              : "Vé và thanh toán trong môi trường mô phỏng."}
          </p>
        </div>
        <TicketStub ticket={props.ticket} live={props.live} />
      </div>
      <TicketActions {...props} />
    </article>
  );
}
