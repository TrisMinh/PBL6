import { useId, type CSSProperties, type ReactElement } from "react";
import "./PriceRange.css";

type Props = {
  minimum: number;
  maximum: number;
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
};
export function PriceRange({
  minimum,
  maximum,
  from,
  to,
  onChange,
}: Props): ReactElement {
  const id = useId();
  const step = 25000;
  const span = maximum - minimum || 1;
  const style = {
    "--price-from": `${Math.max(0, Math.min(100, ((from - minimum) / span) * 100))}%`,
    "--price-to": `${Math.max(0, Math.min(100, ((to - minimum) / span) * 100))}%`,
  } as CSSProperties;
  const format = (value: number): string =>
    `${value.toLocaleString("vi-VN")} đồng`;
  return (
    <div
      className="price-range"
      style={style}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget || event.button !== 0) return;
        const box = event.currentTarget.getBoundingClientRect();
        const ratio = Math.max(
          0,
          Math.min(1, (event.clientX - box.left) / box.width),
        );
        const value = Math.max(
          minimum,
          Math.min(maximum, Math.round((minimum + ratio * span) / step) * step),
        );
        if (Math.abs(value - from) <= Math.abs(value - to)) {
          onChange(Math.min(value, to), to);
          document.getElementById(`${id}-from`)?.focus();
        } else {
          onChange(from, Math.max(value, from));
          document.getElementById(`${id}-to`)?.focus();
        }
      }}
    >
      <span className="price-range__track" aria-hidden />
      <input
        id={`${id}-from`}
        className="price-range__input price-range__input--from"
        aria-label="Giá tối thiểu"
        aria-valuetext={format(from)}
        aria-valuemax={to}
        min={minimum}
        max={maximum}
        step={step}
        value={from}
        type="range"
        onChange={(event) =>
          onChange(Math.min(Number(event.target.value), to), to)
        }
      />
      <input
        id={`${id}-to`}
        className="price-range__input price-range__input--to"
        aria-label="Giá tối đa"
        aria-valuetext={format(to)}
        aria-valuemin={from}
        min={minimum}
        max={maximum}
        step={step}
        value={to}
        type="range"
        onChange={(event) =>
          onChange(from, Math.max(Number(event.target.value), from))
        }
      />
    </div>
  );
}
