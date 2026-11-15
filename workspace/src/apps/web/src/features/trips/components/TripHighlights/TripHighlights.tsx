import { useState, type ReactElement } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Tag } from "@phosphor-icons/react/dist/csr/Tag";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { WifiHigh } from "@phosphor-icons/react/dist/csr/WifiHigh";
import { Plug } from "@phosphor-icons/react/dist/csr/Plug";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { Ticket } from "@phosphor-icons/react/dist/csr/Ticket";
import { Copy } from "@phosphor-icons/react/dist/csr/Copy";
import type { Trip } from "@/features/trips/types/trip";
import { mockTripHighlights } from "@/mocks/fixtures/tripHighlights";
import { isMockApi } from "@/shared/api/config";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { Toast } from "@/shared/ui/Toast/Toast";
import { Button } from "@/shared/ui/Button/Button";
import "./TripHighlights.css";

export function TripAmenities({ trip }: { trip: Trip }): ReactElement {
  return (
    <div className="trip-highlights__amenities" aria-label="Tiện ích chuyến xe">
      {trip.amenities.includes("wifi") && (
        <span data-kind="wifi">
          <WifiHigh size={14} aria-hidden /> Wi-Fi
        </span>
      )}
      {trip.amenities.includes("charging") && (
        <span data-kind="charging">
          <Plug size={14} aria-hidden /> Cổng sạc
        </span>
      )}
      {trip.amenities.includes("doorPickup") && (
        <span data-kind="pickup">
          <MapPin size={14} aria-hidden /> Đón tận nơi
        </span>
      )}
      <span data-kind="ticket">
        <Ticket size={14} aria-hidden /> Vé điện tử
      </span>
    </div>
  );
}

export function TripHighlights({ trip }: { trip: Trip }): ReactElement {
  const offer = isMockApi ? mockTripHighlights[trip.operator.id] : undefined;
  const [notice, setNotice] = useState<{
    text: string;
    error?: boolean;
  } | null>(null);
  async function copyCode(): Promise<void> {
    if (!offer) return;
    try {
      await navigator.clipboard.writeText(offer.code);
      setNotice({ text: `Đã sao chép mã ${offer.code}.` });
    } catch {
      setNotice({
        text: "Chưa sao chép được. Bạn có thể chọn và sao chép mã ở trên.",
        error: true,
      });
    }
  }
  return (
    <>
      {offer && (
        <Dialog.Root>
          <Dialog.Trigger
            className="trip-highlights__offer"
            aria-label={`Xem mã ${offer.code} của ${trip.displayOperatorName}`}
          >
            <Tag size={17} weight="duotone" aria-hidden />
            <span>
              Giảm {offer.percent}% · tối đa {offer.cap / 1000}K
            </span>
            <strong>{offer.code}</strong>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="trip-offer__overlay" />
            <Dialog.Content
              className="trip-offer__dialog"
              aria-describedby="trip-offer-note"
            >
              <div className="trip-offer__icon">
                <Tag size={28} weight="duotone" aria-hidden />
              </div>
              <Dialog.Title>Ưu đãi cho chuyến đi</Dialog.Title>
              <Dialog.Description>
                Giảm {offer.percent}%, tối đa {formatCurrencyVnd(offer.cap)} cho
                chuyến của {trip.displayOperatorName}.
              </Dialog.Description>
              <div className="trip-offer__code">
                <span>MÃ ƯU ĐÃI</span>
                <code>{offer.code}</code>
              </div>
              <ul>
                <li>Đơn tối thiểu {formatCurrencyVnd(offer.minimum)}.</li>
                <li>Mỗi đơn sử dụng một mã, không cộng dồn ưu đãi.</li>
                <li>Giá vé đang hiển thị chưa trừ giảm giá.</li>
              </ul>
              <p id="trip-offer-note" className="trip-offer__note">
                Ưu đãi mẫu để trải nghiệm giao diện. Mã chưa được áp dụng vào
                giao dịch thanh toán.
              </p>
              <Button
                type="button"
                onClick={() => {
                  void copyCode();
                }}
              >
                <Copy size={17} aria-hidden /> Sao chép mã
              </Button>
              <Dialog.Close
                className="trip-offer__close"
                aria-label="Đóng ưu đãi"
              >
                <X size={19} aria-hidden />
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
      {notice && (
        <Toast
          message={notice.text}
          tone={notice.error ? "error" : "success"}
          onClose={() => setNotice(null)}
        />
      )}
    </>
  );
}
