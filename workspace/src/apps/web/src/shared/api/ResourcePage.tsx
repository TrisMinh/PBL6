import { useState, type ReactElement, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useLocation } from "react-router";
import { z } from "zod";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { apiJson } from "./client";
import { ApiError } from "./error";
import { field, type ApiRow } from "./fields";
import { liveQueryKey } from "./liveRequest";
import {
  normalizeSearch,
  shortId,
  stateLabel,
  stateLabels,
} from "./livePresentation";
import { Button } from "@/shared/ui/Button/Button";
import { StatusBadge } from "@/shared/ui/StatusBadge/StatusBadge";
import "./live.css";
export type { ApiRow } from "./fields";

const rowSchema = z.record(z.string(), z.unknown());
const listSchema = z.union([
  z.array(rowSchema).transform((items) => ({ items, totalPages: 1 })),
  z
    .object({ items: z.array(rowSchema), totalPages: z.number().optional() })
    .transform((value) => ({ ...value, totalPages: value.totalPages ?? 1 })),
  z
    .object({ data: z.array(rowSchema) })
    .transform((value) => ({ items: value.data, totalPages: 1 })),
  z
    .object({ passengers: z.array(rowSchema) })
    .transform((value) => ({ items: value.passengers, totalPages: 1 })),
]);
export interface ApiColumn {
  key: string;
  label: string;
  render?: (row: ApiRow) => ReactNode;
}

function ApiValue({
  row,
  column,
}: {
  row: ApiRow;
  column: ApiColumn;
}): ReactElement {
  const value = field(row, column.key);
  if (Array.isArray(row[column.key]))
    return (
      <span>
        {(row[column.key] as unknown[])
          .map((value) => stateLabel(String(value)))
          .join(" · ") || "—"}
      </span>
    );
  if (/status$/i.test(column.key)) {
    const tone = /FAILED|CANCELLED|DISABLED|LOCKED|EXPIRED/.test(value)
      ? "error"
      : /PENDING|PROCESSING|REQUESTED|BOARDING|MAINTENANCE/.test(value)
        ? "warning"
        : /ACTIVE|SUCCEEDED|PAID|CONFIRMED|COMPLETED|COLLECTED|CHECKED_IN|ISSUED/.test(
              value,
            ) &&
            value !== "INACTIVE" &&
            value !== "UNCOLLECTED"
          ? "success"
          : "neutral";
    return <StatusBadge tone={tone}>{stateLabel(value)}</StatusBadge>;
  }
  if (
    value !== "—" &&
    /At$|Date$/i.test(column.key) &&
    !Number.isNaN(Date.parse(value))
  )
    return (
      <time dateTime={value}>
        {new Date(value).toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          ...(column.key.endsWith("Date")
            ? { dateStyle: "short" }
            : { dateStyle: "short", timeStyle: "short" }),
        })}
      </time>
    );
  if (
    value !== "—" &&
    /amount|total|revenue|operatorNet|^fare\.|^price\./i.test(column.key) &&
    Number.isFinite(Number(value))
  )
    return (
      <span className="live-api__money">
        {Number(value).toLocaleString("vi-VN")} ₫
      </span>
    );
  if (/Rate$/.test(column.key) && Number.isFinite(Number(value)))
    return <span>{(Number(value) * 100).toLocaleString("vi-VN")}%</span>;
  return <span title={value}>{stateLabels[value] ?? shortId(value)}</span>;
}
export function ApiFailure({
  error,
  retry,
}: {
  error: Error;
  retry?: () => void;
}): ReactElement {
  return (
    <div role="alert" className="live-api__error">
      <strong>Chưa thể tải hoặc lưu thông tin</strong>
      <p>{error.message}</p>
      {error instanceof ApiError && error.status === 401 ? (
        <Link to="/login">Đăng nhập lại</Link>
      ) : (
        retry && (
          <Button variant="secondary" onClick={retry}>
            Thử lại
          </Button>
        )
      )}
      {error instanceof ApiError && error.correlationId && (
        <small>Mã hỗ trợ: {error.correlationId}</small>
      )}
    </div>
  );
}
export function ApiTable({
  rows,
  columns,
}: {
  rows: ApiRow[];
  columns: ApiColumn[];
}): ReactElement {
  if (!rows.length)
    return (
      <div className="live-api__empty" role="status">
        <span aria-hidden="true">⌕</span>
        <h3>Chưa có dữ liệu phù hợp</h3>
        <p>Thử thay đổi bộ lọc hoặc thêm dữ liệu để bắt đầu.</p>
      </div>
    );
  return (
    <div
      className="live-api__table"
      role="region"
      aria-label="Danh sách dữ liệu"
      tabIndex={0}
    >
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={String(row.id ?? row.ticketId ?? i)}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? (
                    column.render(row)
                  ) : (
                    <ApiValue row={row} column={column} />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function ResourcePage({
  title,
  endpoint,
  columns,
  children,
}: {
  title: string;
  endpoint: string;
  columns: ApiColumn[];
  children?: ReactNode;
  operator?: boolean;
}): ReactElement {
  const { session, isHydrated } = useAccountSession();
  const location = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [requestedPage, setPage] = useState(0);
  const query = useQuery({
    queryKey: liveQueryKey("resource", endpoint),
    queryFn: async ({ signal }) => {
      const rows: ApiRow[] = [];
      for (let page = 0; ; page++) {
        const params = new URL(endpoint, "https://relative.invalid");
        params.searchParams.set("page", String(page));
        params.searchParams.set("size", "100");
        const result = await apiJson(
          params.pathname + params.search,
          listSchema,
          { signal },
        );
        rows.push(...result.items);
        if (page + 1 >= result.totalPages) return rows;
      }
    },
    enabled: isHydrated && Boolean(session),
    retry: false,
  });
  if (!isHydrated) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (!session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  const rows = query.data ?? [];
  const statuses = [
    ...new Set(
      rows
        .map((row) => String(row.status ?? row.collectionStatus ?? ""))
        .filter(Boolean),
    ),
  ];
  const visible = rows.filter(
    (row) =>
      (!status || String(row.status ?? row.collectionStatus) === status) &&
      (!search ||
        normalizeSearch(JSON.stringify(row)).includes(normalizeSearch(search))),
  );
  const pages = Math.max(1, Math.ceil(visible.length / 12));
  const page = Math.min(requestedPage, pages - 1);
  return (
    <section className="live-api live-api--resource">
      <header className="live-api__heading">
        <div>
          <p className="live-api__eyebrow">QUẢN LÝ & THEO DÕI</p>
          <h1>{title}</h1>
          <p>Dữ liệu được cập nhật theo hoạt động trong hệ thống.</p>
        </div>
        <Button
          variant="secondary"
          isLoading={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Làm mới
        </Button>
      </header>
      {children && <div className="live-api__tools">{children}</div>}
      <div className="live-api__filters">
        <label>
          Tìm kiếm
          <input
            type="search"
            placeholder="Nhập tên, mã hoặc thông tin cần tìm…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </label>
        {statuses.length > 0 && (
          <label>
            Trạng thái
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả trạng thái</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {stateLabel(value)}
                </option>
              ))}
            </select>
          </label>
        )}
        <span className="live-api__result-count" role="status">
          {query.isPending
            ? "Đang tải…"
            : `${visible.length.toLocaleString("vi-VN")} kết quả`}
        </span>
      </div>
      {query.isPending ? (
        <div className="live-api__loading" role="status">
          Đang tải danh sách…
        </div>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <ApiTable
            rows={visible.slice(page * 12, (page + 1) * 12)}
            columns={columns}
          />
          <nav className="live-api__pagination" aria-label="Phân trang">
            <span>
              {visible.length ? page * 12 + 1 : 0}–
              {Math.min((page + 1) * 12, visible.length)} / {visible.length} kết
              quả
            </span>
            <div>
              <Button
                variant="secondary"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Trước
              </Button>
              <span>
                Trang {page + 1} / {pages}
              </span>
              <Button
                variant="secondary"
                disabled={page + 1 >= pages}
                onClick={() => setPage(page + 1)}
              >
                Sau
              </Button>
            </div>
          </nav>
        </>
      )}
    </section>
  );
}
export function ResourceDetailPage({
  title,
  endpoint,
  columns,
}: {
  title: string;
  endpoint: string;
  columns: ApiColumn[];
}): ReactElement {
  const { session, isHydrated } = useAccountSession();
  const location = useLocation();
  const query = useQuery({
    queryKey: liveQueryKey("detail", endpoint),
    queryFn: ({ signal }) => apiJson(endpoint, rowSchema, { signal }),
    enabled: isHydrated && Boolean(session),
    retry: false,
  });
  if (!isHydrated) return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  if (!session)
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return (
    <section className="live-api live-api--detail">
      <header className="live-api__heading">
        <div>
          <p className="live-api__eyebrow">THÔNG TIN CHI TIẾT</p>
          <h1>{title}</h1>
        </div>
        <Button
          variant="secondary"
          onClick={() => void query.refetch()}
          isLoading={query.isFetching}
        >
          Cập nhật
        </Button>
      </header>
      {query.isPending ? (
        <div className="live-api__loading" role="status">
          Đang tải thông tin…
        </div>
      ) : query.isError ? (
        <ApiFailure error={query.error} retry={() => void query.refetch()} />
      ) : (
        <dl>
          {columns.map((column) => (
            <div key={column.key}>
              <dt>{column.label}</dt>
              <dd>
                {column.render ? (
                  column.render(query.data)
                ) : (
                  <ApiValue row={query.data} column={column} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
