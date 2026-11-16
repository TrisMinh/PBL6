import { useId, useRef, useState, type ReactElement } from "react";
import { Clock } from "@phosphor-icons/react/dist/csr/Clock";
import "./TimePicker.css";

export function TimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): ReactElement {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hour, setHour] = useState(value.split(":")[0] || "06");
  const [minute, setMinute] = useState(value.split(":")[1] || "00");
  const [draft, setDraft] = useState<{ source: string; text: string } | null>(
    null,
  );
  function prepare(): void {
    setHour(value.split(":")[0] || "06");
    setMinute(value.split(":")[1] || "00");
  }
  function choose(next: string): void {
    setDraft(null);
    onChange(next);
    popup.current?.hidePopover();
    input.current?.focus({ preventScroll: true });
  }
  return (
    <div
      className="time-picker trip-filters__stacked-field"
      data-empty={!value}
    >
      <label htmlFor={`${id}-input`}>GIỜ XUẤT PHÁT</label>
      <input
        id={`${id}-input`}
        className="time-picker__input"
        ref={input}
        aria-label="Giờ xuất phát"
        type="text"
        inputMode="numeric"
        placeholder="Chọn giờ"
        maxLength={5}
        pattern="([01][0-9]|2[0-3]):[0-5][0-9]"
        value={draft?.source === value ? draft.text : value}
        onChange={(event) => {
          const text = event.target.value;
          setDraft({ source: value, text });
          if (!text || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(text)) onChange(text);
        }}
        onBlur={() => setDraft(null)}
        onClick={(event) => {
          event.currentTarget.focus();
          prepare();
          popup.current?.showPopover();
        }}
        onKeyDown={(event) => {
          if (
            (event.altKey && event.key === "ArrowDown") ||
            event.key === "F4"
          ) {
            event.preventDefault();
            prepare();
            popup.current?.showPopover();
          }
        }}
      />
      <button
        className="time-picker__trigger"
        type="button"
        popoverTarget={`${id}-popup`}
        aria-label="Mở bộ chọn giờ"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={prepare}
      >
        <Clock size={19} aria-hidden />
      </button>
      <div
        id={`${id}-popup`}
        ref={popup}
        popover="auto"
        className="time-picker__popup"
        role="dialog"
        aria-label="Chọn giờ khởi hành"
        onToggle={(event) => setOpen(event.newState === "open")}
      >
        {open && (
          <>
            <h2>Giờ khởi hành</h2>
            <p>Tìm các chuyến khởi hành từ giờ đã chọn.</p>
            <div className="time-picker__fields">
              <label>
                Giờ
                <select
                  aria-label="Giờ"
                  value={hour}
                  onChange={(event) => setHour(event.target.value)}
                >
                  {Array.from({ length: 24 }, (_, n) => {
                    const text = String(n).padStart(2, "0");
                    return (
                      <option key={text} value={text}>
                        {text}
                      </option>
                    );
                  })}
                </select>
              </label>
              <span aria-hidden>:</span>
              <label>
                Phút
                <select
                  aria-label="Phút"
                  value={minute}
                  onChange={(event) => setMinute(event.target.value)}
                >
                  {Array.from({ length: 60 }, (_, n) => {
                    const text = String(n).padStart(2, "0");
                    return (
                      <option key={text} value={text}>
                        {text}
                      </option>
                    );
                  })}
                </select>
              </label>
            </div>
            <footer>
              <button
                type="button"
                disabled={!value}
                onClick={() => choose("")}
              >
                Xóa giờ
              </button>
              <button type="button" onClick={() => choose(`${hour}:${minute}`)}>
                Chọn giờ
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
