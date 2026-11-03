import { differenceInMinutes, parseISO } from "date-fns";
import { isTripUnavailable } from "@/features/trips/lib/isTripUnavailable";
import { useId, type ReactElement } from "react";

import type { Trip } from "@/features/trips/types/trip";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { Button } from "@/shared/ui/Button/Button";
import busIcon from "@/assets/trip-results/bus.svg";
import operatorBlue from "@/assets/trip-results/operator-blue.svg";
import operatorGold from "@/assets/trip-results/operator-gold.svg";
import operatorGreen from "@/assets/trip-results/operator-green.svg";
import routeDestination from "@/assets/trip-results/route-destination.svg";
import routeLine from "@/assets/trip-results/route-line.svg";
import ticketIcon from "@/assets/trip-results/ticket.svg";

import "./TripCard.css";

export interface TripCardProps {
  trip: Trip;
  onSelect: (trip: Trip) => void;
  isPending?: boolean;
  disabled?: boolean;
}

const DISPLAY_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Ho_Chi_Minh",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatDuration(trip: Trip): string {
  const minutes = differenceInMinutes(
    parseISO(trip.arrivalTime),
    parseISO(trip.departureTime),
  );
  if (minutes === 0) return "Dưới 1 phút";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours > 0) return `${hours} giờ${remainder ? ` ${remainder}` : ""}`;
  return `${remainder} phút`;
}

function TripOperator({
  trip,
  headingId,
}: {
  trip: Trip;
  headingId: string;
}): ReactElement {
  const mark =
    trip.operator.id.includes("sao-mai") ||
    trip.operator.id.includes("cao-nguyen")
      ? operatorGreen
      : trip.operator.id.includes("duong-viet")
        ? operatorGold
        : operatorBlue;
  return (
    <header className="trip-card__header">
      <span className="trip-card__initial" aria-hidden="true">
        <img alt="" src={mark} />
        {trip.displayOperatorName.charAt(0)}
      </span>
      <h2 className="trip-card__operator" id={headingId}>
        {trip.displayOperatorName}
      </h2>
      <span className="trip-card__vehicle">{trip.vehicleLabel}</span>
    </header>
  );
}

function TripStop({
  timestamp,
  name,
}: {
  timestamp: string;
  name: string;
}): ReactElement {
  return (
    <div className="trip-card__stop">
      <time className="trip-card__time" dateTime={timestamp}>
        <strong className="trip-card__clock">
          {DISPLAY_TIME.format(new Date(timestamp))}
        </strong>
      </time>
      <span className="trip-card__terminal">{name}</span>
    </div>
  );
}

function TripSchedule({ trip }: { trip: Trip }): ReactElement {
  return (
    <div className="trip-card__schedule">
      <TripStop timestamp={trip.departureTime} name={trip.originStopName} />
      <div className="trip-card__journey">
        <span className="trip-card__duration">{formatDuration(trip)}</span>
        <span className="trip-card__track" aria-hidden="true">
          <img className="trip-card__bus" alt="" src={busIcon} />
          <img className="trip-card__line" alt="" src={routeLine} />
          <img
            className="trip-card__destination"
            alt=""
            src={routeDestination}
          />
        </span>
        <span className="trip-card__direct">Đi thẳng</span>
      </div>
      <TripStop timestamp={trip.arrivalTime} name={trip.destinationStopName} />
    </div>
  );
}

function TripFare({
  trip,
  statusId,
}: {
  trip: Trip;
  statusId: string;
}): ReactElement {
  const soldOut = trip.availableSeatCount === 0;
  const seatsClassName = [
    "trip-card__seats",
    soldOut ? "trip-card__seats--sold-out" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="trip-card__fare-row">
      <span className={seatsClassName} id={statusId}>
        <img alt="" aria-hidden src={ticketIcon} />
        {trip.seatCountIsCapacity
          ? `Xe ${trip.availableSeatCount} chỗ`
          : soldOut
            ? "Hết chỗ"
            : `Còn ${trip.availableSeatCount} ghế`}
      </span>
      <span className="trip-card__fare">
        <strong>{formatCurrencyVnd(trip.fareVnd)}</strong>
        <span className="trip-card__caption">/ khách</span>
      </span>
    </div>
  );
}

export function TripCard({
  trip,
  onSelect,
  isPending = false,
  disabled = false,
}: TripCardProps): ReactElement {
  const id = useId();
  const headingId = `${id}-operator`;
  const routeId = `${id}-route`;
  const statusId = `${id}-seats`;
  return (
    <article
      className="trip-card"
      id={`trip-${trip.id}`}
      data-vehicle-type={trip.vehicleType}
      aria-labelledby={`${headingId} ${routeId}`}
    >
      <TripOperator trip={trip} headingId={headingId} />
      <p className="trip-card__route" id={routeId}>
        {trip.origin.province} → {trip.destination.province}
      </p>
      <TripSchedule trip={trip} />
      <TripFare trip={trip} statusId={statusId} />
      {trip.stops && (
        <details className="trip-card__details">
          <summary>Chi tiết chuyến & điểm đón trả</summary>
          <div className="trip-card__details-body">
            <p>
              <strong>Tiện ích:</strong>{" "}
              {trip.amenities
                .map(
                  (amenity) =>
                    ({
                      wifi: "Wi-Fi",
                      charging: "Cổng sạc",
                      restroom: "Nhà vệ sinh",
                      doorPickup: "Đón tận nơi",
                    })[amenity],
                )
                .join(" · ") || "Chưa có thông tin"}
            </p>
            <ol>
              {[...trip.stops]
                .sort((a, b) => a.sequence - b.sequence)
                .map((stop) => (
                  <li key={stop.id}>
                    <div>
                      <strong>{stop.name}</strong>
                      <time
                        dateTime={new Date(
                          Date.parse(trip.departureTime) +
                            stop.offsetMinutes * 60000,
                        ).toISOString()}
                      >
                        {DISPLAY_TIME.format(
                          new Date(
                            Date.parse(trip.departureTime) +
                              stop.offsetMinutes * 60000,
                          ),
                        )}
                      </time>
                    </div>
                    {stop.address && <p>{stop.address}</p>}
                    <span>
                      {[
                        stop.pickupAllowed && "Đón khách",
                        stop.dropoffAllowed && "Trả khách",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "Điểm dừng"}
                    </span>
                  </li>
                ))}
            </ol>
            <p>
              <strong>Thanh toán:</strong>{" "}
              {trip.allowPayLater
                ? "Thanh toán trực tuyến hoặc thanh toán sau theo lựa chọn khi đặt vé."
                : "Thanh toán trực tuyến."}
            </p>
            {trip.policyVersion && (
              <p>
                <strong>Hủy vé:</strong> Phí hủy và số tiền hoàn được hiển thị
                theo đơn trước khi bạn xác nhận hủy vé.
              </p>
            )}
            <p className="trip-card__inventory-note">
              Chọn chuyến để kiểm tra ghế còn trống và giữ chỗ.
            </p>
          </div>
        </details>
      )}
      <Button
        className="trip-card__select"
        type="button"
        disabled={
          disabled || trip.availableSeatCount === 0 || isTripUnavailable(trip)
        }
        isLoading={isPending}
        aria-describedby={statusId}
        onClick={() => onSelect(trip)}
      >
        {isTripUnavailable(trip) ? "Đã ngừng bán" : "Chọn chuyến"}
      </Button>
    </article>
  );
}
