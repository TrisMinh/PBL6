import type { ReactElement } from "react";

import "./GuardState.css";

export function GuardLoading(): ReactElement {
  return (
    <p className="guard-state" role="status">
      Đang kiểm tra phiên…
    </p>
  );
}
