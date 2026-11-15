import type { ButtonHTMLAttributes, ReactElement } from "react";

import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: ButtonVariant;
}

export function Button({
  children,
  className = "",
  disabled,
  isLoading = false,
  variant = "primary",
  ...props
}: ButtonProps): ReactElement {
  const classes = ["button", `button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...props}
      aria-busy={isLoading || undefined}
      className={classes}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <>
          <span className="button__content" aria-hidden="true">
            {children}
          </span>
          <span className="button__progress" aria-hidden="true" />
          <span className="button__loading-label">Đang xử lý</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
