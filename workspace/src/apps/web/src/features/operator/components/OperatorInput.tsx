import { useId, type ReactElement } from "react";
import { Input, type InputProps } from "@/shared/ui/Input/Input";
import { DatePicker } from "@/shared/ui/DatePicker/DatePicker";

/** Operator date fields use the same calendar as customer search. */
export function OperatorInput({
  label,
  error,
  id,
  className,
  trailingControl,
  showYearPicker,
  ...props
}: InputProps & { showYearPicker?: boolean }): ReactElement {
  const generated = useId();
  if (props.type !== "date")
    return (
      <Input
        {...props}
        label={label}
        error={error}
        id={id}
        className={className}
        trailingControl={trailingControl}
      />
    );
  const inputId = id ?? generated;
  const { type: inputType, ...dateProps } = props;
  const errorId = `${inputId}-error`;
  return (
    <div className="field" data-control={inputType}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <DatePicker
        {...dateProps}
        showYearPicker={showYearPicker}
        id={inputId}
        className={`field__control ${className ?? ""}`}
        aria-invalid={Boolean(error)}
        aria-describedby={
          [props["aria-describedby"], error ? errorId : undefined]
            .filter(Boolean)
            .join(" ") || undefined
        }
      />
      {trailingControl}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
