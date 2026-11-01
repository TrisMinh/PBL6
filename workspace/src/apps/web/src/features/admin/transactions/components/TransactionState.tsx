import type { ReactElement } from "react";
import { Link } from "react-router";

import type { TransactionResource } from "../transactionConfig";

export type TransactionStateKind =
  "loading" | "empty" | "error" | "forbidden" | "not-found" | "invalid";
const STATE_COPY = {
  loading: {
    title: "Đang tải dữ liệu",
    description:
      "Đang kiểm tra quyền và lấy dữ liệu mới nhất. Vui lòng chờ trong giây lát.",
  },
  empty: {
    title: "Không tìm thấy kết quả",
    description:
      "Không có dữ liệu phù hợp trong phạm vi bạn được phép xem. Thử đổi mã tra cứu hoặc xóa bộ lọc.",
  },
  error: {
    title: "Chưa tải được dữ liệu",
    description:
      "Kết nối bị gián đoạn. Chưa thể xác định trạng thái giao dịch; vui lòng thử lại.",
  },
  forbidden: {
    title: "Bạn chưa có quyền truy cập",
    description:
      "Tài khoản hiện tại không được phép xem dữ liệu này. Liên hệ quản trị viên để kiểm tra quyền truy cập.",
  },
  "not-found": {
    title: "Không tìm thấy hồ sơ",
    description:
      "Hồ sơ không tồn tại hoặc không nằm trong phạm vi bạn được phép xem.",
  },
  invalid: {
    title: "Không thể tải dữ liệu",
    description: "Không thể tải hồ sơ. Vui lòng kiểm tra lại yêu cầu.",
  },
} satisfies Record<
  TransactionStateKind,
  { title: string; description: string }
>;

export function TransactionState({
  state,
  resource,
  detail = false,
  onRetry,
  onClear,
}: {
  state: TransactionStateKind;
  resource: TransactionResource;
  detail?: boolean;
  onRetry?: () => void;
  onClear?: () => void;
}): ReactElement {
  const copy = STATE_COPY[state];
  return (
    <div
      className={`transaction-state transaction-state--${state}`}
      role={state === "loading" ? "status" : undefined}
      aria-label={state === "loading" ? copy.title : undefined}
      aria-busy={state === "loading" ? true : undefined}
    >
      <h3>{copy.title}</h3>
      <p>{copy.description}</p>
      {state === "empty" && (
        <button onClick={onClear} type="button">
          Xóa bộ lọc
        </button>
      )}
      {state === "error" && (
        <button onClick={onRetry} type="button">
          Thử lại
        </button>
      )}
      {state === "forbidden" && (
        <Link to={detail ? `/admin/${resource}` : "/admin/organizations"}>
          {detail ? "Về danh sách" : "Về Tổ chức"}
        </Link>
      )}
      {state === "not-found" && (
        <Link to={`/admin/${resource}`}>Quay lại danh sách</Link>
      )}
    </div>
  );
}
