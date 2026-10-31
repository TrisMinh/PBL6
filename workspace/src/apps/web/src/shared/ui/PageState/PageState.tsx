import { useId, type ReactElement, type ReactNode } from "react";

import "./PageState.css";

export interface PageStateProps {
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageState({
  title,
  description,
  action,
}: PageStateProps): ReactElement {
  const id = useId();
  return (
    <section
      className="page-state"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <h1 className="page-state__title" id={`${id}-title`}>
        {title}
      </h1>
      <p className="page-state__description" id={`${id}-description`}>
        {description}
      </p>
      {action && <div className="page-state__action">{action}</div>}
    </section>
  );
}
