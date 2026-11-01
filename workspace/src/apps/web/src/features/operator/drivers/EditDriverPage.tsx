import type { ReactElement } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DriverEditor } from "./DriverEditor";
import { getDrivers } from "./driversRepository";
import { OperatorSidebar } from "../components/OperatorSidebar";
import { PageState } from "@/shared/ui/PageState/PageState";
import { Button } from "@/shared/ui/Button/Button";
import "../schedule/SchedulePage.css";
import "./DriversPage.css";
export function EditDriverPage(): ReactElement {
  const { driverId } = useParams(),
    navigate = useNavigate();
  const query = useQuery({
    queryKey: ["operator-drivers"],
    queryFn: ({ signal }) => getDrivers(signal),
  });
  const driver = query.data?.find((d) => d.id === driverId);
  if (!query.isPending && !query.isError && driver)
    return <DriverEditor key={driver.id} driver={driver} />;
  return (
    <div className="operator-schedule operator-drivers">
      <OperatorSidebar />
      <main className="operator-schedule__main">
        <header className="operator-schedule__header">
          <h1>Chỉnh sửa hồ sơ tài xế</h1>
        </header>
        {query.isPending ? (
          <PageState
            title="Đang tải hồ sơ"
            description="Vui lòng chờ trong giây lát."
          />
        ) : query.isError ? (
          <PageState
            title="Không tải được hồ sơ"
            description={query.error.message}
            action={
              <Button onClick={() => void query.refetch()}>Thử lại</Button>
            }
          />
        ) : (
          <PageState
            title="Không tìm thấy tài xế"
            description="Hồ sơ không tồn tại trong danh sách của phiên hiện tại."
            action={
              <Button
                variant="secondary"
                onClick={() => navigate("/operator/drivers")}
              >
                Quay lại danh sách
              </Button>
            }
          />
        )}
      </main>
    </div>
  );
}
