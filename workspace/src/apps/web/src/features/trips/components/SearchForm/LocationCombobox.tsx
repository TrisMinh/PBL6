import { useId, useState, type ReactElement } from "react";
import type { Location } from "../../types/trip";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

export function LocationCombobox({
  label,
  placeholder,
  options,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  options: readonly Location[];
  value: string;
  onChange: (id: string) => void;
  onBlur: () => void;
  error?: string | undefined;
  disabled?: boolean;
}): ReactElement {
  const id = useId();
  const selected = options.find((option) => option.id === value);
  const [draft, setDraft] = useState({ value, text: selected?.name ?? "" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const text = draft.value === value ? draft.text : (selected?.name ?? "");
  const filtered = options.filter((option) =>
    normalize(option.name).includes(normalize(value ? "" : text)),
  );
  const expanded = open && !disabled;
  const choose = (option: Location): void => {
    setDraft({ value: option.id, text: option.name });
    onChange(option.id);
    setOpen(false);
    setActive(-1);
  };
  return (
    <div className="search-form__field search-form__combobox">
      <label className="search-form__label" htmlFor={id}>
        {label}
      </label>
      <div className="search-form__combo-control">
        <input
          id={id}
          role="combobox"
          className="search-form__control"
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          aria-required="true"
          aria-expanded={expanded}
          aria-autocomplete="list"
          aria-controls={`${id}-list`}
          aria-activedescendant={
            expanded && active >= 0 && active < filtered.length
              ? `${id}-option-${active}`
              : undefined
          }
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          onFocus={() => {
            setOpen(true);
            setActive(-1);
          }}
          onChange={(event) => {
            setDraft({ value: "", text: event.target.value });
            onChange("");
            setOpen(true);
            setActive(-1);
          }}
          onBlur={() => {
            setOpen(false);
            setDraft({ value, text: selected?.name ?? "" });
            onBlur();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              setActive(-1);
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((index) =>
                filtered.length
                  ? index < 0
                    ? event.key === "ArrowDown"
                      ? 0
                      : filtered.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        filtered.length) %
                      filtered.length
                  : -1,
              );
            }
            if (event.key === "Enter" && expanded) {
              event.preventDefault();
              const target =
                active >= 0 ? filtered[active] : (selected ?? filtered[0]);
              if (target) choose(target);
            }
          }}
        />
        <span className="search-form__combo-chevron" aria-hidden="true">
          ⌄
        </span>
      </div>
      {expanded && (
        <div className="search-form__dropdown">
          <ul id={`${id}-list`} role="listbox" aria-label={label}>
            {filtered.map((option, index) => (
              <li
                id={`${id}-option-${index}`}
                key={option.id}
                role="option"
                aria-selected={option.id === value}
                className={active === index ? "is-active" : ""}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <span className="search-form__location-icon" aria-hidden="true">
                  ⌖
                </span>
                <span>
                  {option.name}
                  <small>
                    Điểm {label === "Điểm đi" ? "khởi hành" : "đến"}
                  </small>
                </span>
                {option.id === value && (
                  <span
                    className="search-form__location-check"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!filtered.length && (
            <p className="search-form__no-locations" role="status">
              {options.length
                ? "Không tìm thấy địa điểm phù hợp."
                : "Chưa có tuyến phù hợp."}
            </p>
          )}
        </div>
      )}
      {error && (
        <p className="search-form__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
