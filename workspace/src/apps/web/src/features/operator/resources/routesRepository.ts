import { apiFetch as fetch } from "@/shared/api/client";
import {
  operatorRouteSchema,
  routeResponseSchema,
  routeInputSchema,
  type RouteInput,
  type OperatorRoute,
} from "./routes.schema";
export async function getOperatorRoutes(
  signal?: AbortSignal,
): Promise<OperatorRoute[]> {
  const response = await fetch("/api/v1/operator/routes-preview", { signal });
  if (!response.ok) throw Error("Không tải được tuyến. Vui lòng thử lại.");
  return routeResponseSchema.parse(await response.json()).items;
}
export async function saveOperatorRoute(
  input: RouteInput,
  create: boolean,
): Promise<OperatorRoute> {
  const route = routeInputSchema.parse(input);
  const response = await fetch(
    `/api/v1/operator/routes-preview${create ? "" : "/" + encodeURIComponent(route.id)}`,
    {
      method: create ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(route),
    },
  );
  if (!response.ok)
    throw Error(
      response.status === 409
        ? "Mã tuyến đã tồn tại. Chọn mã tuyến khác."
        : response.status === 400
          ? "Thông tin tuyến hoặc điểm dừng chưa hợp lệ."
          : "Không lưu được tuyến. Vui lòng thử lại.",
    );
  return operatorRouteSchema.parse(await response.json());
}
