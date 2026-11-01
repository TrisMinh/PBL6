import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactElement, type ReactNode } from "react";

import "./CancellationConfirmDialog.css";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusId: string;
  children: ReactNode;
}

export function CancellationConfirmDialog({
  open,
  onOpenChange,
  returnFocusId,
  children,
}: Props): ReactElement {
  const contentRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="cancellation-dialog__overlay" />
        <Dialog.Content
          className="cancellation-dialog__content"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            contentRef.current?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document
              .getElementById(returnFocusId)
              ?.focus({ preventScroll: true });
          }}
          ref={contentRef}
          tabIndex={-1}
        >
          <Dialog.Title className="cancellation-dialog__sr-only">
            Xác nhận hủy vé
          </Dialog.Title>
          <Dialog.Description className="cancellation-dialog__sr-only">
            Kiểm tra vé, chính sách và số tiền hoàn trước khi xác nhận.
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
