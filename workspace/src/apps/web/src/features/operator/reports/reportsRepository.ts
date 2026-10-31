import { apiFetch as fetch } from "@/shared/api/client";
import {
  reportSchema,
  type OperatorReport,
  type ReportPeriod,
} from "./reports.schema";
export async function getOperatorReport(
  from: string,
  to: string,
  period: ReportPeriod,
  signal?: AbortSignal,
): Promise<OperatorReport> {
  const response = await fetch(
    `/api/v1/operator/reports-preview?${new URLSearchParams({ from, to, period })}`,
    { signal },
  );
  if (!response.ok)
    throw Error(
      response.status === 400
        ? "Khoảng ngày không hợp lệ. Chọn lại bộ lọc."
        : "Không tải được báo cáo. Vui lòng thử lại.",
    );
  return reportSchema.parse(await response.json());
}
