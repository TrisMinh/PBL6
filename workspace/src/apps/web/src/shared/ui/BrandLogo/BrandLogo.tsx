import type { ReactElement } from "react";

import officialLogo from "@/assets/brand/blue-official-logo.png";

import "./BrandLogo.css";

export interface BrandLogoProps {
  placement: "header" | "footer" | "auth";
  className?: string;
}

export function BrandLogo({
  placement,
  className = "",
}: BrandLogoProps): ReactElement {
  const classes = ["brand-logo", `brand-logo--${placement}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      <img
        className="brand-logo__image"
        src={officialLogo}
        alt="BLUE"
        width={1021}
        height={406}
      />
    </span>
  );
}
