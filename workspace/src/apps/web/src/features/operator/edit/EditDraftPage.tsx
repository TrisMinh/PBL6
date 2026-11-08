import type { ReactElement } from "react";
import { CreateTripPage } from "../create/CreateTripPage";
export function EditDraftPage(): ReactElement {
  return <CreateTripPage mode="edit" />;
}
