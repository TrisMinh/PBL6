import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { conflictLabel, type ScheduleTrip } from "../tripAvailability";

export interface ResourceOption {
  id: string;
  label: string;
  description: string;
  disabled?: boolean;
  disabledReason?: string;
  conflicts: ScheduleTrip[];
}
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[\s.-]/g, "");
}
export function ResourcePicker({
  label,
  placeholder,
  value,
  selectedLabel,
  options,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  selectedLabel?: string;
  options: ResourceOption[];
  disabled: boolean;
  onChange: (id: string) => void;
}): ReactElement {
  const id = useId(),
    root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null),
    search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [active, setActive] = useState("");
  const expanded = open && !disabled;
  const selected = options.find((o) => o.id === value);
  const filtered = options
    .filter((o) =>
      normalize(
        [
          o.label,
          o.description,
          ...o.conflicts.flatMap((t) => [t.origin ?? "", t.destination ?? ""]),
        ].join(" "),
      ).includes(normalize(query)),
    )
    .sort(
      (a, b) =>
        Number(!!a.disabled) - Number(!!b.disabled) ||
        a.label.localeCompare(b.label, "vi"),
    );
  useEffect(() => {
    if (!expanded) return;
    search.current?.focus();
    const outside = (e: PointerEvent): void => {
      if (e.target instanceof Node && !root.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded]);
  const choose = (option: ResourceOption): void => {
    if (option.disabled) return;
    onChange(option.id);
    setOpen(false);
    setQuery("");
    setActive("");
    trigger.current?.focus();
  };
  const keyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const available = filtered.filter((o) => !o.disabled),
        i = available.findIndex((o) => o.id === active);
      const next =
        available[
          i < 0
            ? e.key === "ArrowDown"
              ? 0
              : available.length - 1
            : (i + (e.key === "ArrowDown" ? 1 : -1) + available.length) %
              available.length
        ];
      setActive(next?.id ?? "");
    }
    if (e.key === "Enter" && expanded) {
      e.preventDefault();
      const target =
        filtered.find((o) => o.id === active) ??
        filtered.find((o) => !o.disabled);
      if (target) choose(target);
    }
  };
  useEffect(() => {
    if (expanded && active)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [active, expanded, id]);
  return (
    <div
      ref={root}
      className="operator-create__field resource-picker"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setOpen(false);
      }}
    >
      <span id={`${id}-label`}>{label}</span>
      <button
        ref={trigger}
        type="button"
        role="combobox"
        aria-label={label}
        aria-required="true"
        aria-expanded={expanded}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        disabled={disabled}
        className="resource-picker__trigger"
        onKeyDown={keyDown}
        onClick={() => {
          setOpen(!expanded);
          setQuery("");
          setActive("");
        }}
      >
        <span className={!value ? "resource-picker__placeholder" : ""}>
          {selected?.label ?? selectedLabel ?? placeholder}
        </span>
        {selected?.disabled && (
          <small>{selected.disabledReason ?? "Không khả dụng"}</small>
        )}
        <span aria-hidden="true">⌄</span>
      </button>
      {expanded && (
        <div className="resource-picker__popup">
          <div className="resource-picker__search">
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="10" cy="10" r="6.5" />
              <path d="m15 15 5 5" />
            </svg>
            <input
              ref={search}
              type="search"
              aria-label={`Tìm ${label.toLowerCase()}`}
              placeholder={
                label === "Xe"
                  ? "Tìm biển số, loại xe…"
                  : "Nhập số GPLX để tìm…"
              }
              autoComplete="off"
              value={query}
              aria-controls={`${id}-list`}
              aria-activedescendant={active ? `${id}-${active}` : undefined}
              onKeyDown={keyDown}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive("");
              }}
            />
          </div>
          <ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}>
            {filtered.map((o) => (
              <li
                key={o.id}
                id={`${id}-${o.id}`}
                role="option"
                data-resource-id={o.id}
                aria-selected={o.id === value}
                aria-disabled={!!o.disabled}
                className={`resource-picker__option ${o.disabled ? "is-disabled" : ""} ${active === o.id ? "is-active" : ""}`}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
              >
                <div className="resource-picker__option-title">
                  <strong>{o.label}</strong>
                  {o.disabled ? (
                    <b>{o.disabledReason ?? "Trùng lịch"}</b>
                  ) : o.id === value ? (
                    <span aria-hidden="true">✓</span>
                  ) : null}
                </div>
                {o.description && (
                  <span className="resource-picker__description">
                    {o.description}
                  </span>
                )}
                {o.conflicts.map((t) => (
                  <div key={t.id} className="resource-picker__conflict">
                    <strong>
                      {t.origin && t.destination
                        ? `${t.origin} → ${t.destination}`
                        : "Chuyến đã phân công"}
                    </strong>
                    <span>{conflictLabel([t])}</span>
                  </div>
                ))}
              </li>
            ))}
          </ul>
          {!filtered.length && (
            <p className="resource-picker__empty" role="status">
              Không tìm thấy lựa chọn phù hợp.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
