import { useQuery } from "@tanstack/react-query";
import { getOperatorRoutes } from "../resources/routesRepository";

export function useDriverRoutes(enabled = true) {
  return useQuery({
    queryKey: ["operator", "resource-routes"],
    queryFn: ({ signal }) => getOperatorRoutes(signal),
    enabled,
  });
}

export function driverRouteLabel(
  routeId: string | undefined,
  routes: ReturnType<typeof useDriverRoutes>,
): string {
  if (!routeId) return "Chưa phân tuyến";
  if (routes.isError && !routes.data) return "Không tải được thông tin tuyến";
  if (!routes.data) return "Đang tải thông tin tuyến…";

  const route = routes.data.find((item) => item.id === routeId);
  if (!route) return "Tuyến đã chọn không còn trong danh sách";
  const name = route.name || `${route.origin} → ${route.destination}`;
  return route.status === "active" ? name : `${name} (Tạm ngừng)`;
}
