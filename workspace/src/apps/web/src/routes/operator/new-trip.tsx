import { isMockApi } from "@/shared/api/config";
import { LiveTripEditor } from "@/features/operator/LiveOperatorForms";
import type { ReactElement } from "react";
import { CreateTripPage } from "@/features/operator/create/CreateTripPage";
export default function NewTripRoute(): ReactElement {
  return isMockApi ? (
    <CreateTripPage />
  ) : (
    <LiveTripEditor />
  );
}
