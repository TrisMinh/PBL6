import { useState, type ReactElement } from "react";
import { Button } from "@/shared/ui/Button/Button";
import { SeatStateDialog } from "./SeatConflictDialog/SeatStateDialog";

export function CancelSeatSessionButton({
  disabled,
  pending,
  onConfirm,
}: {
  disabled: boolean;
  pending: boolean;
  onConfirm: () => void;
}): ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        isLoading={pending}
        onClick={() => setOpen(true)}
      >
        Hủy phiên đặt ghế
      </Button>
      <SeatStateDialog
        open={open}
        variant="limit"
        eyebrow="PHIÊN ĐẶT GHẾ"
        title="Hủy phiên đặt ghế?"
        description="Các ghế bạn đang giữ sẽ được trả về sơ đồ. Bạn cần chọn lại ghế nếu muốn đặt tiếp."
        statusLead="Phiên đặt ghế sẽ kết thúc"
        statusDetail="Bạn có thể giữ phiên và tiếp tục đặt vé."
        onClose={() => setOpen(false)}
        secondary={
          <Button
            type="button"
            variant="secondary"
            onClick={() => setOpen(false)}
          >
            Giữ phiên
          </Button>
        }
        primary={
          <Button
            type="button"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            Xác nhận hủy phiên
          </Button>
        }
      />
    </>
  );
}
