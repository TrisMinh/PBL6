import type { ReactElement } from "react";

import scenicBus from "@/assets/admin/transport-banner.png";

interface OrganizationPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
}

export function OrganizationPageHeader({
  description,
  eyebrow,
  meta,
  title,
}: OrganizationPageHeaderProps): ReactElement {
  return (
    <header className="organization-page__hero">
      <img alt="" className="organization-page__hero-image" src={scenicBus} />
      <div className="organization-page__hero-shade" />
      <div className="organization-page__hero-copy">
        <p className="organization-page__eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <p className="organization-page__meta">{meta}</p>
      </div>
    </header>
  );
}
