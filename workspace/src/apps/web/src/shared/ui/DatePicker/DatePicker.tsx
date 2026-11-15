import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import {
  addDays,
  addMonths,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { CaretLeft } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/csr/CaretRight";
import { getVietnamTodayDate } from "@/shared/lib/getVietnamTodayDate";
import "./DatePicker.css";

type Props = Omit<ComponentProps<"input">, "type"> & { disablePast?: boolean };
export function DatePicker({
  ref: forwardedRef,
  className = "",
  onChange,
  onClick,
  onKeyDown,
  min,
  max,
  disablePast = false,
  ...props
}: Props): ReactElement {
  const generated = useId();
  const popupId = `${generated}-calendar`;
  const input = useRef<HTMLInputElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const [today, setToday] = useState(() => getVietnamTodayDate());
  const [month, setMonth] = useState(() =>
    startOfMonth(parseISO(String(props.value || props.defaultValue || today))),
  );
  const [selected, setSelected] = useState(
    String(props.value || props.defaultValue || ""),
  );
  const [open, setOpen] = useState(false);
  const lower = disablePast ? today : typeof min === "string" ? min : "";
  const upper = typeof max === "string" ? max : "";
  const disabled = (date: string): boolean =>
    Boolean((lower && date < lower) || (upper && date > upper));
  const active = String(props.value ?? selected);
  const first = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const title = `Tháng ${month.getMonth() + 1}, ${month.getFullYear()}`;
  const tabDate =
    active && active.slice(0, 7) === format(month, "yyyy-MM")
      ? active
      : today.slice(0, 7) === format(month, "yyyy-MM")
        ? today
        : format(month, "yyyy-MM-dd");
  function prepare(): void {
    const currentToday = getVietnamTodayDate();
    setToday(currentToday);
    const current = input.current?.value || currentToday;
    setMonth(startOfMonth(parseISO(current)));
  }
  function choose(value: string): void {
    if (!input.current) return;
    input.current.value = value;
    setSelected(value);
    onChange?.({
      target: input.current,
      currentTarget: input.current,
      type: "change",
    } as ChangeEvent<HTMLInputElement>);
    popup.current?.hidePopover();
    input.current.focus({ preventScroll: true });
  }
  function move(event: KeyboardEvent<HTMLButtonElement>, date: Date): void {
    let next: Date;
    switch (event.key) {
      case "ArrowLeft":
        next = addDays(date, -1);
        break;
      case "ArrowRight":
        next = addDays(date, 1);
        break;
      case "ArrowUp":
        next = addDays(date, -7);
        break;
      case "ArrowDown":
        next = addDays(date, 7);
        break;
      case "Home":
        next = startOfWeek(date, { weekStartsOn: 1 });
        break;
      case "End":
        next = addDays(startOfWeek(date, { weekStartsOn: 1 }), 6);
        break;
      case "PageUp":
        next = addMonths(date, -1);
        break;
      case "PageDown":
        next = addMonths(date, 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    const value = format(next, "yyyy-MM-dd");
    if (disabled(value)) return;
    setMonth(startOfMonth(next));
    window.requestAnimationFrame(() =>
      popup.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${value}"]`)
        ?.focus(),
    );
  }
  return (
    <div className="date-picker">
      <input
        {...props}
        min={min}
        max={max}
        type="date"
        className={`date-picker__input ${className}`}
        ref={(element) => {
          input.current = element;
          if (typeof forwardedRef === "function") forwardedRef(element);
          else if (forwardedRef) forwardedRef.current = element;
        }}
        onChange={(event) => {
          setSelected(event.target.value);
          onChange?.(event);
        }}
        onClick={(event) => {
          event.preventDefault();
          event.currentTarget.focus();
          prepare();
          popup.current?.showPopover();
          onClick?.(event);
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
          onKeyDown?.(event);
        }}
      />
      <button
        className="date-picker__trigger"
        type="button"
        disabled={props.disabled}
        popoverTarget={popupId}
        aria-label="Mở lịch chọn ngày"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={prepare}
      >
        <CalendarBlank size={19} aria-hidden />
      </button>
      <div
        className="date-picker__popup"
        id={popupId}
        ref={popup}
        popover="auto"
        role="dialog"
        aria-label="Lịch chọn ngày đi"
        onToggle={(event) => {
          setOpen(event.newState === "open");
          if (event.newState === "open")
            window.requestAnimationFrame(() =>
              popup.current
                ?.querySelector<HTMLButtonElement>(
                  `[data-date="${input.current?.value || today}"]:not(:disabled)`,
                )
                ?.focus(),
            );
        }}
      >
        {open && (
          <>
            <header className="date-picker__heading">
              <strong aria-live="polite">{title}</strong>
              <div>
                <button
                  type="button"
                  aria-label="Tháng trước"
                  onClick={() => setMonth(addMonths(month, -1))}
                >
                  <CaretLeft size={17} aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="Tháng sau"
                  onClick={() => setMonth(addMonths(month, 1))}
                >
                  <CaretRight size={17} aria-hidden />
                </button>
              </div>
            </header>
            <div className="date-picker__weekdays" aria-hidden>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div role="grid" aria-label={title}>
              {Array.from({ length: 6 }, (_, row) => (
                <div className="date-picker__week" role="row" key={row}>
                  {Array.from({ length: 7 }, (_, col) => {
                    const date = addDays(first, row * 7 + col);
                    const value = format(date, "yyyy-MM-dd");
                    return (
                      <button
                        key={value}
                        type="button"
                        role="gridcell"
                        data-date={value}
                        data-outside={
                          date.getMonth() !== month.getMonth() || undefined
                        }
                        data-today={value === today || undefined}
                        aria-label={new Intl.DateTimeFormat("vi-VN", {
                          dateStyle: "full",
                        }).format(date)}
                        aria-selected={value === active}
                        disabled={disabled(value)}
                        tabIndex={value === tabDate ? 0 : -1}
                        onKeyDown={(event) => move(event, date)}
                        onClick={() => choose(value)}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <footer className="date-picker__footer">
              <button
                type="button"
                disabled={props.required || !active}
                onClick={() => choose("")}
              >
                Xóa ngày
              </button>
              <button
                type="button"
                disabled={disabled(today)}
                onClick={() => choose(today)}
              >
                Hôm nay
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
