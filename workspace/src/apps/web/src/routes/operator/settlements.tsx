import { BackendOperatorPage } from "@/features/operator/BackendOperatorPage";
import type { ReactElement } from "react";
import { isMockApi } from "@/shared/api/config";
import { SettlementsPage } from "@/features/operator/organization/SettlementsPage";

export default function SettlementsRoute(): ReactElement {
  return isMockApi ? <SettlementsPage /> : <BackendOperatorPage resource="settlements" />;
}
