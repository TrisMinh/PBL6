import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactElement } from "react";
import { Button } from "@/shared/ui/Button/Button";
import { stopKind, type LiveStop } from "./liveRoutes";
import "./AddRouteStopModal.css";

export function LiveRouteStopModal({
  stop,
  stops,
  duration,
  onSave,
  onClose,
}: {
  stop?: LiveStop;
  stops: LiveStop[];
  duration: number;
  onSave: (stop: LiveStop) => void;
  onClose: () => void;
}): ReactElement {
  const [name, setName] = useState(stop?.name ?? "");
  const [address, setAddress] = useState(stop?.address ?? "");
  const [offset, setOffset] = useState(stop?.offsetMinutes ?? 0);
  const [kind, setKind] = useState(
    stop
      ? stop.pickupAllowed && stop.dropoffAllowed
        ? "both"
        : stop.pickupAllowed
          ? "pickup"
          : "dropoff"
      : "both",
  );
  const [error, setError] = useState("");
  const draft: LiveStop = {
    id: stop?.id ?? "",
    name: name.trim(),
    address: address.trim() || null,
    offsetMinutes: offset,
    sequence: stop?.sequence ?? stops.length,
    pickupAllowed: kind !== "dropoff",
    dropoffAllowed: kind !== "pickup",
  };
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="operator-add-stop__overlay" />
        <Dialog.Content className="operator-add-stop__dialog live-route-stop">
          <header className="operator-add-stop__header">
            <Dialog.Title>
              {stop ? "Chỉnh sửa điểm đón/trả" : "Thêm điểm đón/trả"}
            </Dialog.Title>
            <Dialog.Description>
              Nhập địa điểm và xác định cách phục vụ trên tuyến.
            </Dialog.Description>
            <Dialog.Close asChild>
              <button type="button" aria-label="Đóng hộp thoại">
                ×
              </button>
            </Dialog.Close>
          </header>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !draft.name ||
                !Number.isInteger(offset) ||
                offset < 0 ||
                offset > duration
              ) {
                setError(
                  "Nhập tên địa điểm và thời gian nằm trong thời lượng tuyến.",
                );
                return;
              }
              if (
                stops.some(
                  (item) =>
                    item.sequence !== stop?.sequence &&
                    item.name.trim().toLocaleLowerCase("vi") ===
                      draft.name.toLocaleLowerCase("vi"),
                )
              ) {
                setError("Địa điểm đã có trên tuyến.");
                return;
              }
              onSave(draft);
            }}
          >
            <div className="operator-add-stop__body">
              <div className="operator-add-stop__two">
                <label className="operator-add-stop__field">
                  <span>TÊN ĐỊA ĐIỂM</span>
                  <input
                    aria-label="Tên địa điểm"
                    required
                    maxLength={200}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <label className="operator-add-stop__field">
                  <span>PHÚT TỪ ĐIỂM ĐẦU</span>
                  <input
                    aria-label="Phút từ điểm đầu"
                    type="number"
                    required
                    min={0}
                    max={duration}
                    value={offset}
                    onChange={(event) => setOffset(Number(event.target.value))}
                  />
                </label>
              </div>
              <label className="operator-add-stop__field operator-add-stop__place">
                <span>ĐỊA CHỈ</span>
                <input
                  aria-label="Địa chỉ"
                  maxLength={500}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                />
              </label>
              <fieldset className="operator-add-stop__types">
                <legend>LOẠI ĐIỂM</legend>
                <div>
                  {[
                    ["pickup", "Điểm đón"],
                    ["dropoff", "Điểm trả"],
                    ["both", "Điểm đón & trả"],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className={
                        kind === value
                          ? "operator-add-stop__type--selected"
                          : ""
                      }
                    >
                      <input
                        type="radio"
                        name="stopKind"
                        value={value}
                        checked={kind === value}
                        onChange={() => setKind(value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="operator-add-stop__preview" aria-live="polite">
                <span>ĐỊA ĐIỂM ĐÃ CHỌN</span>
                <strong>{name.trim() || "Chưa nhập địa điểm"}</strong>
                <p>
                  {address || "Chưa nhập địa chỉ"} · {stopKind(draft)}
                </p>
              </div>
              {error && (
                <p role="alert" className="operator-add-stop__error">
                  {error}
                </p>
              )}
            </div>
            <footer className="operator-add-stop__actions">
              <Button type="button" variant="secondary" onClick={onClose}>
                Hủy
              </Button>
              <Button type="submit">{stop ? "Lưu điểm" : "Thêm điểm"}</Button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
