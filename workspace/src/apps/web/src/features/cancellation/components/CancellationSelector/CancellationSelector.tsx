import type { ReactElement } from "react";

import selectedCheckbox from "@/assets/cancellation/checkbox.svg";
import passengerIcon from "@/assets/cancellation/passenger.svg";
import phoneIcon from "@/assets/cancellation/phone.svg";
import type { TicketDetail } from "@/features/tickets/types/ticketAccess";

import "./CancellationSelector.css";

interface Props {
  tickets: readonly TicketDetail[];
  selectedIds: readonly string[];
  maskedPhones: Readonly<Record<string, string>>;
  onToggle: (ticketId: string) => void;
}

export function CancellationSelector({
  tickets,
  selectedIds,
  maskedPhones,
  onToggle,
}: Props): ReactElement {
  return (
    <fieldset className="cancellation-selector">
      <div className="cancellation-selector__heading">
        <legend>Chọn vé cần hủy</legend>
        <p>
          Đã chọn {selectedIds.length} / {tickets.length} vé
        </p>
      </div>
      <div className="cancellation-selector__list">
        {tickets.map((ticket) => {
          const checked = selectedIds.includes(ticket.ticketId);
          return (
            <label
              className="cancellation-selector__ticket"
              key={ticket.ticketId}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(ticket.ticketId)}
              />
              <span className="cancellation-selector__seat">
                {ticket.seatCode}
              </span>
              <img alt="" aria-hidden="true" src={passengerIcon} />
              <strong>{ticket.passenger.fullName}</strong>
              <span className="cancellation-selector__divider" />
              <img alt="" aria-hidden="true" src={phoneIcon} />
              <span className="cancellation-selector__phone">
                {maskedPhones[ticket.ticketId]}
              </span>
              {checked ? (
                <img
                  alt=""
                  aria-hidden="true"
                  className="cancellation-selector__check"
                  src={selectedCheckbox}
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="cancellation-selector__check cancellation-selector__check--empty"
                />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
