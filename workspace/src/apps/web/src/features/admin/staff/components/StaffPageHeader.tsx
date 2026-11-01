import type { ReactElement } from "react";

import sectionIcon from "@/assets/admin/staff-section.svg";

interface StaffPageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  meta: string;
}

export function StaffPageHeader({
  description,
  title,
}: StaffPageHeaderProps): ReactElement {
  return (
    <header className="staff-page__hero">
      <img
        alt=""
        className="staff-page__section-icon"
        src={sectionIcon}
        width={32}
        height={32}
      />
      <div className="staff-page__hero-copy">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </header>
  );
}
