import { BackendOperatorPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";

export default function SettlementsRoute(): ReactElement {
  return <BackendOperatorPage resource="settlements" />;
}
