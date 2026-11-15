import {
  useId,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";

import "./Input.css";

export interface InputProps extends ComponentProps<"input"> {
  label: string;
  error?: string;
  trailingControl?: ReactNode;
}

export function Input({
  "aria-describedby": ariaDescribedBy,
  className = "",
  error,
  id,
  label,
  trailingControl,
  ...props
}: InputProps): ReactElement {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const descriptionIds = [ariaDescribedBy, error ? errorId : undefined]
    .filter(Boolean)
    .join(" ");
  const classes = ["field__control", className].filter(Boolean).join(" ");
  const control = (
    <input
      {...props}
      aria-describedby={descriptionIds || undefined}
      aria-invalid={Boolean(error)}
      className={classes}
      id={inputId}
    />
  );

  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      {trailingControl ? (
        <div className="field__control-frame">
          {control}
          {trailingControl}
        </div>
      ) : (
        control
      )}
      {error ? (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
