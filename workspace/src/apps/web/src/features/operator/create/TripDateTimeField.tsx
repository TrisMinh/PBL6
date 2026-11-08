import { useId, type ReactElement } from "react";

export function TripDateTimeField({
  label,
  value,
  onChange,
  disabled = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}): ReactElement {
  const [date = "", time = ""] = value.split("T");
  const errorId = useId();
  const [hour = "", minute = ""] = time.split(":");
  return (
    <div
      className="operator-create__field"
      role="group"
      aria-label={label}
      aria-invalid={!!error}
    >
      <span>{label}</span>
      <div className="operator-trip-workflow__datetime">
        <input
          type="date"
          aria-label={`${label} - Ngày`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          required
          disabled={disabled}
          value={date}
          onChange={(e) => onChange(`${e.target.value}T${time}`)}
        />
        <div className="operator-trip-workflow__clock">
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${label} - Giờ`}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            title="Giờ (00–23)"
            placeholder="HH"
            required
            disabled={disabled}
            maxLength={2}
            pattern="([01][0-9]|2[0-3])"
            value={hour}
            onChange={(e) =>
              onChange(`${date}T${e.target.value}:${minute || "00"}`)
            }
            onBlur={() => {
              if (/^[0-9]$/.test(hour))
                onChange(`${date}T${hour.padStart(2, "0")}:${minute || "00"}`);
            }}
          />
          <span aria-hidden="true">:</span>
          <input
            type="text"
            inputMode="numeric"
            aria-label={`${label} - Phút`}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            title="Phút (00–59)"
            placeholder="mm"
            required
            disabled={disabled}
            maxLength={2}
            pattern="[0-5][0-9]"
            value={minute}
            onChange={(e) =>
              onChange(`${date}T${hour || "00"}:${e.target.value}`)
            }
            onBlur={() => {
              if (/^[0-9]$/.test(minute))
                onChange(`${date}T${hour || "00"}:${minute.padStart(2, "0")}`);
            }}
          />
        </div>
      </div>
      {error && (
        <p id={errorId} className="operator-trip-workflow__time-error">
          {error}
        </p>
      )}
    </div>
  );
}
