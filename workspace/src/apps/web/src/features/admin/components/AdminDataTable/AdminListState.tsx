import type { ReactElement } from "react";

import { Button } from "@/shared/ui/Button/Button";
import { PageState } from "@/shared/ui/PageState/PageState";

import "./AdminListState.css";

interface LoadingStateProps {
  state: "loading";
  label: string;
}

interface EmptyStateProps {
  state: "empty";
  title: string;
  description: string;
}

interface ErrorStateProps {
  state: "error";
  title: string;
  description: string;
  onRetry: () => void;
  retryLabel?: string;
}

export type AdminListStateProps =
  LoadingStateProps | EmptyStateProps | ErrorStateProps;

export function AdminListState(props: AdminListStateProps): ReactElement {
  if (props.state === "loading") {
    return (
      <section
        aria-busy="true"
        aria-label={props.label}
        aria-live="polite"
        className="admin-list-state admin-list-state--loading"
        role="status"
      >
        Đang tải dữ liệu
      </section>
    );
  }

  const action =
    props.state === "error" ? (
      <Button onClick={props.onRetry} type="button" variant="secondary">
        {props.retryLabel ?? "Thử lại"}
      </Button>
    ) : undefined;

  return (
    <div className={`admin-list-state admin-list-state--${props.state}`}>
      <PageState
        action={action}
        description={props.description}
        title={props.title}
      />
    </div>
  );
}
