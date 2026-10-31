import { z } from "zod";
import type { RouteStop } from "./routes.schema";
export const cataloguePlaceSchema = z.object({
  id: z.string().min(1),
  province: z.string().min(1),
  district: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1).max(200),
  km: z.number().finite().nonnegative(),
});
export type CataloguePlace = z.infer<typeof cataloguePlaceSchema>;
export const stopCatalogueSchema = z.object({
  items: z.array(cataloguePlaceSchema),
});
export function cataloguePlaceToStop(
  place: CataloguePlace,
  kind: RouteStop["kind"],
  existing: RouteStop[],
  distance: number,
): RouteStop {
  if (
    existing.some(
      (stop) =>
        stop.id === `place:${place.id}` ||
        stop.name.trim().toLocaleLowerCase("vi") ==
          place.name.trim().toLocaleLowerCase("vi"),
    )
  )
    throw Error(
      "Địa điểm này đã có trên tuyến. Chọn địa điểm khác hoặc chỉnh sửa điểm hiện có.",
    );
  if (place.km > distance)
    throw Error("Địa điểm nằm ngoài chiều dài tuyến hiện tại.");
  return {
    id: `place:${place.id}`,
    name: place.name,
    address: place.address,
    kind,
    km: place.km,
  };
}
