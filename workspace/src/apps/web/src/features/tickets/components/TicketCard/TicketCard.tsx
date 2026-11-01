import type { ReactElement } from "react";
import { Link } from "react-router";

import ticketPerforation from "@/assets/tickets/ticket-perforation.svg";
import ticketQr from "@/assets/tickets/ticket-qr.png";
import ticketReady from "@/assets/tickets/ticket-ready.svg";
import ticketTimeline from "@/assets/tickets/ticket-timeline.svg";
import type { TicketDetail } from "@/features/tickets/types/ticketAccess";
import {
  ROUTES,
  bookingCancellationPath,
  ticketPath,
} from "@/shared/config/routes";
import { formatDateTime } from "@/shared/lib/formatDateTime";
import { StatusBadge } from "@/shared/ui/StatusBadge/StatusBadge";
import { BrandLogo } from "@/shared/ui/BrandLogo/BrandLogo";

import "./TicketCard.css";

interface Props {
  ticket: TicketDetail;
  ticketCodes: readonly string[];
}
function TicketHeader({ ticket }: { ticket: TicketDetail }): ReactElement {
  return (
    <header className="ticket-card__header">
      <div className="ticket-card__brand">
        <BrandLogo placement="header" className="ticket-card__brand-logo" />
        <StatusBadge tone={ticket.status === "issued" ? "success" : "error"}>
          {ticket.status === "issued" ? "Đã phát hành" : "Đã hủy"}
        </StatusBadge>
        <span>{ticket.bookingCode}</span>
      </div>
      <h2>
        {ticket.trip.origin.province} → {ticket.trip.destination.province}
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
          <p>{ticket.trip.origin.name}</p>
          <span>{formatDateTime(ticket.trip.departureTime, "dd/MM/yyyy")}</span>
        </div>
        <div className="ticket-card__timeline" aria-hidden="true">
          <img src={ticketTimeline} alt="" />
        </div>
        <div>
          <time dateTime={ticket.trip.arrivalTime}>
            {formatDateTime(ticket.trip.arrivalTime)}
          </time>
          <p>{ticket.trip.destination.name}</p>
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
    ["Điểm đón", ticket.trip.origin.name],
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
function TicketStub({ ticket, ticketCodes }: Props): ReactElement {
  return (
    <aside className="ticket-card__stub" aria-label="Mã vé và điều hướng">
      <img
        className="ticket-card__perforation"
        src={ticketPerforation}
        alt=""
        aria-hidden="true"
      />
      <figure className="ticket-card__marker">
        <span>QUÉT KHI LÊN XE</span>
        <img
          src={ticketQr}
          alt="Mã vé minh họa, không dùng để quét"
          data-presentation-only="true"
        />
        <figcaption>
          {ticket.status === "issued"
            ? "Minh họa mã vé — không dùng để quét"
            : "Vé đã hủy — mã vé không còn hiệu lực"}
        </figcaption>
      </figure>
      <strong className="ticket-card__code">{ticket.ticketCode}</strong>
      <p>Vé và thanh toán trong môi trường mô phỏng.</p>
      <nav className="ticket-card__links" aria-label="Vé trong đặt vé này">
        {ticketCodes
          .filter((code) => code !== ticket.ticketCode)
          .map((code) => (
            <Link key={code} to={ticketPath(code)}>
              Xem vé {code}
            </Link>
          ))}
        <Link to={ROUTES.ticketLookup}>Tra cứu vé khác</Link>
        {ticket.status === "issued" ? (
          <Link to={bookingCancellationPath(ticket.bookingCode)}>Hủy vé</Link>
        ) : null}
      </nav>
    </aside>
  );
}
export function TicketCard(props: Props): ReactElement {
  return (
    <article
      className="ticket-card"
      aria-label={
        props.ticket.status === "issued" ? "Vé đã phát hành" : "Vé đã hủy"
      }
    >
      <TicketHeader ticket={props.ticket} />
      <div className="ticket-card__body">
        <div className="ticket-card__content">
          <TicketJourney ticket={props.ticket} />
          <TicketFacts ticket={props.ticket} />
          <p className="ticket-card__notice">
            <img src={ticketReady} alt="" aria-hidden="true" />
            <span>
              <strong>Sẵn sàng để quét</strong>
              Vui lòng có mặt sớm và chuẩn bị giấy tờ cần thiết.
            </span>
          </p>
          <p className="ticket-card__policy">
            QR chỉ hợp lệ khi vé ở trạng thái Đã phát hành. Hủy vé và hoàn tiền
            được xử lý theo chính sách riêng.
          </p>
        </div>
        <TicketStub {...props} />
      </div>
    </article>
  );
}
