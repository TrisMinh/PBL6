import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import "./SearchableFilterSelect.css";

export interface SearchableFilterOption {
  value: string;
  label: string;
  searchText?: string;
}

interface Props {
  id?: string;
  label: string;
  allLabel: string;
  value: string;
  options: readonly SearchableFilterOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi")
    .trim();
}

/** Small lists keep a native select. Lists with eight or more choices add search. */
export function SearchableFilterSelect({
  id,
  label,
  allLabel,
  value,
  options,
  onChange,
  disabled = false,
  className = "",
}: Props): ReactElement {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const listId = `${controlId}-options`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [above, setAbove] = useState(false);
  const searchable = options.length >= 8;
  const shown = options.filter((option) =>
    normalize(`${option.label} ${option.searchText ?? ""}`).includes(
      normalize(query),
    ),
  );
  const visible = [{ value: "", label: allLabel }, ...shown];
  const selected = options.find((option) => option.value === value);
  useEffect(() => {
    if (!open || disabled || !searchable) return;
    search.current?.focus();
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, disabled, searchable]);
  const close = (): void => {
    setOpen(false);
    trigger.current?.focus();
  };
  const choose = (next: string): void => {
    onChange(next);
    close();
  };
  const toggle = (): void => {
    if (!open) {
      const bounds = trigger.current?.getBoundingClientRect();
      setAbove(
        Boolean(
          bounds &&
          window.innerHeight - bounds.bottom < 260 &&
          bounds.top > window.innerHeight - bounds.bottom,
        ),
      );
      setQuery("");
    }
    setOpen(!open);
  };
  const focusOption = (index: number): void => {
    root.current
      ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
      [index]?.focus();
  };
  const searchKeys = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(event.key === "ArrowDown" ? 0 : visible.length - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (query.trim() && shown.length) choose(shown[0].value);
    }
  };
  if (!searchable)
    return (
      <select
        id={controlId}
        aria-label={label}
        className={className}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  return (
    <div
      className="searchable-filter"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        id={controlId}
        className={`searchable-filter__trigger ${className}`}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open && !disabled}
        aria-controls={open && !disabled ? listId : undefined}
        disabled={disabled}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) toggle();
            else search.current?.focus();
          }
        }}
      >
        <span className="searchable-filter__selection">
          {selected?.label ?? allLabel}
        </span>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
          <path
            d="m6 9 6 6 6-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      </button>
      {open && !disabled && (
        <div className="searchable-filter__popup" data-above={above}>
          <input
            ref={search}
            className="searchable-filter__search"
            aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`}
            placeholder={`Tìm ${label.toLocaleLowerCase("vi")}…`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={searchKeys}
            autoComplete="off"
          />
          <div
            role="listbox"
            id={listId}
            aria-label={label}
            className="searchable-filter__options"
          >
            {visible.map((option, index) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                data-value={option.value}
                aria-selected={option.value === value}
                key={option.value}
                className="searchable-filter__option"
                onClick={() => choose(option.value)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    focusOption((index + 1) % visible.length);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    if (index === 0) search.current?.focus();
                    else focusOption(index - 1);
                  } else if (event.key === "Home" || event.key === "End") {
                    event.preventDefault();
                    focusOption(event.key === "Home" ? 0 : visible.length - 1);
                  }
                }}
              >
                <span>{option.label}</span>
                <span aria-hidden="true">
                  {option.value === value ? "✓" : ""}
                </span>
              </button>
            ))}
          </div>
          {!shown.length && (
            <p className="searchable-filter__empty" role="status">
              Không tìm thấy kết quả.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
