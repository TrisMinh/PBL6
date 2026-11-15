import * as Dialog from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react/dist/csr/X";
import type { ReactElement, ReactNode } from "react";
import { Button } from "@/shared/ui/Button/Button";

export function WorkspaceDialogHeading({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <div className="operator-workspace-demo__dialog-header">
      <Dialog.Title>{children}</Dialog.Title>
      <Dialog.Close asChild>
        <Button variant="ghost" type="button" aria-label="Đóng hộp thoại">
          <X size={20} aria-hidden="true" />
        </Button>
      </Dialog.Close>
    </div>
  );
}
