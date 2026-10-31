import { apiFetch as fetch } from "@/shared/api/client";
import {
  stopCatalogueSchema,
  type CataloguePlace,
} from "./stopCatalogue.schema";
export async function getStopCatalogue(
  origin: string,
  destination: string,
  distance: number,
  signal?: AbortSignal,
): Promise<CataloguePlace[]> {
  const params = new URLSearchParams({
    origin,
    destination,
    distance: String(distance),
  });
  const response = await fetch(`/api/v1/operator/stop-catalogue?${params}`, {
    signal,
  });
  if (!response.ok)
    throw Error("Không tải được danh mục địa điểm. Vui lòng thử lại.");
  return stopCatalogueSchema.parse(await response.json()).items;
}
