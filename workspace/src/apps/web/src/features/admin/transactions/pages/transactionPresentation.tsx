import type { ReactElement } from "react";

import { AdminListState } from "@/features/admin/components/AdminDataTable/AdminListState";
import { AdminRepositoryError } from "@/features/admin/repositories/adminRepositoryError";
import { PageState } from "@/shared/ui/PageState/PageState";

export function TransactionFailure({
  error,
  noun,
  onRetry,
  detail = false,
}: {
  error: Error;
  noun: string;
  onRetry: () => void;
  detail?: boolean;
}): ReactElement {
  const repositoryError =
    error instanceof AdminRepositoryError ? error : undefined;
  if (repositoryError?.status === 403)
    return (
      <PageState
        description={`Tài khoản hiện tại không được phép xem ${noun}.`}
        title="Không có quyền truy cập"
      />
    );
  if (detail && repositoryError?.status === 404)
    return (
      <PageState
        description={`Hồ sơ ${noun} không tồn tại hoặc đã bị xóa.`}
        title={`Không tìm thấy ${noun}`}
      />
    );
  if (repositoryError && !repositoryError.canRetry)
    return (
      <PageState
        description={`Không thể tải ${noun}. Vui lòng kiểm tra lại yêu cầu.`}
        title="Không thể tải dữ liệu"
      />
    );
  return (
    <AdminListState
      description={`Không thể tải ${noun}.`}
      onRetry={onRetry}
      state="error"
      title="Tải dữ liệu thất bại"
    />
  );
}
