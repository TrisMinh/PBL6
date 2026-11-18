import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { AdminListParams } from "../../schemas/adminListParams.schema";

function MeasuredList({
  children,
  measure,
  enabled,
}: {
  children: ReactNode;
  measure: boolean;
  enabled: boolean;
}): ReactElement {
  const content = useRef<HTMLDivElement>(null);
  const width = useRef(0);
  const [minHeight, setMinHeight] = useState(0);
  useEffect(() => {
    if (!measure || !content.current || typeof ResizeObserver === "undefined")
      return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const sameWidth = Math.abs(width.current - entry.contentRect.width) < 1;
      width.current = entry.contentRect.width;
      const height = Math.ceil(entry.contentRect.height);
      setMinHeight((previous) =>
        sameWidth ? Math.max(previous, height) : height,
      );
    });
    observer.observe(content.current);
    return () => observer.disconnect();
  }, [measure]);
  return (
    <div
      className="admin-list-viewport"
      style={{ minHeight: enabled && minHeight ? minHeight : undefined }}
    >
      <div ref={content}>{children}</div>
    </div>
  );
}

/** Keep the pager stationary when a later page contains fewer rows. Reset for filters/size. */
export function AdminListViewport({
  params,
  children,
  measure,
  enabled = true,
}: {
  params: AdminListParams;
  children: ReactNode;
  measure: boolean;
  enabled?: boolean;
}): ReactElement {
  return (
    <MeasuredList
      key={JSON.stringify([
        params.pageSize,
        params.query,
        params.status,
        params.organizationId,
      ])}
      measure={measure}
      enabled={enabled}
    >
      {children}
    </MeasuredList>
  );
}
