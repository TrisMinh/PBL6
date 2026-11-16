import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import type { ReactElement } from "react";

import "./GuardState.css";

export function GuardLoading(): ReactElement {
  return <BrandLoading compact title="Đang kiểm tra phiên…" />;
}
