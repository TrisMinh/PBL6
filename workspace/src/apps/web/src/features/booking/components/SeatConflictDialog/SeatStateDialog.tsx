import * as Dialog from "@radix-ui/react-dialog";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

import expiredBackground from "@/assets/booking/expired-icon-background.svg";
import expiredClock from "@/assets/booking/expired-clock-outline.svg";
import expiredClockHorizontal from "@/assets/booking/expired-clock-hand-horizontal.svg";
import expiredClockVertical from "@/assets/booking/expired-clock-hand-vertical.svg";
import { Button } from "@/shared/ui/Button/Button";

import "./SeatConflictDialog.css";

interface SeatStateDialogProps {
  open: boolean;
  variant: "expired" | "limit";
  eyebrow: string;
  title: string;
  description: string;
  statusLead: string;
  statusDetail: string;
  primary: ReactNode;
  secondary: ReactNode;
  onClose: () => void;
  onFocusReturn?: () => void;
}

export function SeatStateDialog({
  open,
  variant,
  eyebrow,
  title,
  description,
  statusLead,
  statusDetail,
  primary,
  secondary,
  onClose,
  onFocusReturn,
}: SeatStateDialogProps): ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="seat-conflict__overlay" />
        <Dialog.Content
          className={`seat-conflict__content seat-conflict__content--${variant}`}
          onCloseAutoFocus={(event) => {
            if (!onFocusReturn) return;
            event.preventDefault();
            onFocusReturn();
          }}
        >
          <header className="seat-conflict__header">
            <span>{eyebrow}</span>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" aria-label="Đóng thông báo">
                <XIcon size={20} aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </header>
          <div
            className={`seat-conflict__state-icon seat-conflict__state-icon--${variant}`}
            aria-hidden="true"
          >
            {variant === "expired" ? (
              <>
                <img
                  className="seat-conflict__clock-background"
                  src={expiredBackground}
                  alt=""
                />
                <img
                  className="seat-conflict__clock-outline"
                  src={expiredClock}
                  alt=""
                />
                <img
                  className="seat-conflict__clock-hand-vertical"
                  src={expiredClockVertical}
                  alt=""
                />
                <img
                  className="seat-conflict__clock-hand-horizontal"
                  src={expiredClockHorizontal}
                  alt=""
                />
              </>
            ) : (
              <WarningCircleIcon size={42} />
            )}
          </div>
          <Dialog.Title className="seat-conflict__title">{title}</Dialog.Title>
          <Dialog.Description className="seat-conflict__description">
            {description}
          </Dialog.Description>
          <div className="seat-conflict__status">
            {variant === "expired" ? (
              <>
                <strong className="seat-conflict__timer-badge">00:00</strong>
                <span className="seat-conflict__status-copy">
                  <strong>{statusLead}</strong>
                  <small>{statusDetail}</small>
                </span>
              </>
            ) : (
              <>
                <strong>{statusLead}</strong>
                <span className="seat-conflict__status-detail--limit">
                  {statusDetail}
                </span>
              </>
            )}
          </div>
          <footer className="seat-conflict__actions">
            {secondary}
            {primary}
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function DialogActionLink({
  to,
  children,
  onClick,
  variant = "secondary",
}: {
  to: string;
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}): ReactElement {
  return (
    <Link
      className={`seat-conflict__back seat-conflict__${variant}`}
      to={to}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
