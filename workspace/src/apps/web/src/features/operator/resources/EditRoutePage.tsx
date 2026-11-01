import type { ReactElement } from "react";
import { Link, useLocation, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { CreateRoutePage } from "./CreateRoutePage";
import { getOperatorRoutes } from "./routesRepository";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { PageState } from "@/shared/ui/PageState/PageState";
import { Button } from "@/shared/ui/Button/Button";
export function EditRoutePage(): ReactElement {
  const { routeId } = useParams();
  const location = useLocation();
  const query = useQuery({
    queryKey: ["operator", "resource-routes"],
    queryFn: ({ signal }) => getOperatorRoutes(signal),
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
  const route = query.data?.find((item) => item.id === routeId);
  const returnTo =
    typeof location.state?.returnTo === "string" &&
    (location.state.returnTo === "/operator/routes" ||
      location.state.returnTo.startsWith("/operator/routes?"))
      ? location.state.returnTo
      : `/operator/routes?route=${encodeURIComponent(routeId ?? "")}&status=all`;
  if (route && !query.isError)
    return (
      <CreateRoutePage
        key={route.id + route.updatedAt}
        route={route}
        returnTo={returnTo}
      />
    );
  return (
    <div className="operator-schedule operator-routes operator-new-route">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>Chỉnh sửa tuyến {routeId}</h1>
          <Link to="/operator/routes" className="operator-new-route__back">
            ← Quản lý tuyến
          </Link>
        </header>
        {query.isPending ? (
          <p role="status">Đang tải thông tin tuyến…</p>
        ) : (
          <PageState
            title={
              query.isError ? "Không tải được tuyến" : "Không tìm thấy tuyến"
            }
            description={
              query.isError
                ? query.error.message
                : "Mã tuyến này không tồn tại trong dữ liệu hiện tại."
            }
            action={
              <>
                <Link to="/operator/routes">Quản lý tuyến</Link>
                {query.isError && (
                  <Button onClick={() => void query.refetch()}>Thử lại</Button>
                )}
              </>
            }
          />
        )}
      </main>
    </div>
  );
}
