import * as Dialog from "@radix-ui/react-dialog";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import type { ReactElement } from "react";
import { Link } from "react-router";

import { Button } from "@/shared/ui/Button/Button";

import "./SeatConflictDialog.css";

export interface SeatConflictDialogProps {
  open: boolean;
  codes: readonly string[];
  resultsPath: string;
  onClose: () => void;
  onChooseAgain: () => void;
  onFocusReturn: () => void;
}
function ConflictDetails({
  codes,
}: Pick<SeatConflictDialogProps, "codes">): ReactElement {
  return (
    <>
      <Dialog.Title className="seat-conflict__title">
        {codes.length
          ? `Vị trí ${codes.join(", ")} đã được chọn`
          : "Vị trí vừa được chọn"}
      </Dialog.Title>
      <Dialog.Description className="seat-conflict__description">
        Vị trí vừa chọn không còn khả dụng. Vui lòng chọn vị trí ghế trống khác
        để có trải nghiệm chuyến đi tốt nhất.
      </Dialog.Description>
      <ul
        className="seat-conflict__seats"
        aria-label="Vị trí không còn khả dụng"
      >
        {codes.map((code) => (
          <li key={code}>
            <strong>{code}</strong>
            <span className="seat-conflict__status-copy">
              <strong>Không còn khả dụng</strong>
              <small>Vui lòng chọn vị trí ghế trống khác</small>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
function ConflictHeader(): ReactElement {
  return (
    <header className="seat-conflict__header">
      <WarningCircleIcon size={24} aria-hidden="true" />
      <span>CẬP NHẬT TÌNH TRẠNG GHẾ</span>
      <Dialog.Close asChild>
        <Button type="button" variant="ghost" aria-label="Đóng thông báo">
          <XIcon size={20} aria-hidden="true" />
        </Button>
      </Dialog.Close>
    </header>
  );
}
export function SeatConflictDialog(
  props: SeatConflictDialogProps,
): ReactElement {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="seat-conflict__overlay" />
        <Dialog.Content
          className="seat-conflict__content"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            props.onFocusReturn();
          }}
        >
          <ConflictHeader />
          <ConflictDetails codes={props.codes} />
          <footer className="seat-conflict__actions">
            <Link className="seat-conflict__back" to={props.resultsPath}>
              Quay lại danh sách
            </Link>
            <Button type="button" onClick={props.onChooseAgain}>
              Chọn lại ghế
            </Button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
