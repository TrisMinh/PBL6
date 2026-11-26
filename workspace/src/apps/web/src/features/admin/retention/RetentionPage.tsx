import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";
import { z } from "zod";
import { apiFetch, apiJson } from "@/shared/api/client";
import { Button } from "@/shared/ui/Button/Button";
import "./RetentionPage.css";

const endpoint = "/api/v1/admin/retention";
const settingsSchema = z.object({
  enabled: z.boolean(),
  days: z.number(),
  hour: z.number(),
});
const sizeSchema = z.object({ database: z.string(), bytes: z.number() });
const fileSchema = z.object({
  name: z.string(),
  rows: z.number(),
  bytes: z.number(),
  sha256: z.string(),
});
const runSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  status: z.string(),
  before: z.array(sizeSchema),
  after: z.array(sizeSchema),
  files: z.array(fileSchema),
  error: z.string().nullable(),
});
const statusSchema = z.object({
  settings: settingsSchema,
  active: runSchema.nullable(),
  history: z.array(runSchema),
});
const previewSchema = z.object({
  cutoff: z.string(),
  candidates: z.array(z.object({ key: z.string(), rows: z.number() })),
  databases: z.array(sizeSchema),
  estimatedAfter: z.array(sizeSchema),
  publishedOutboxOlderThanCutoff: z.number(),
});
const labels: Record<string, string> = {
  transactions: "Hồ sơ đơn, vé và giao dịch đã đóng",
  trips: "Chuyến và phân công",
  seats: "Ghế không còn tham chiếu",
  holds: "Giữ ghế hết hạn",
  delivery: "Lượt gửi thông báo đã kết thúc",
};
const databaseLabels: Record<string, string> = {
  identity: "Tài khoản",
  transport: "Vận tải",
  booking: "Đặt vé",
  payment: "Thanh toán",
  notification: "Thông báo",
  reporting: "Báo cáo",
};
const statuses: Record<string, string> = {
  queued: "Đang chờ",
  running: "Đang lưu trữ",
  completed: "Đã hoàn tất",
  interrupted: "Bị gián đoạn",
  failed: "Đã dừng do lỗi",
};
const numeric = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
const dates = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Ho_Chi_Minh",
});
const mib = (bytes: number): string => numeric.format(bytes / 1048576) + " MiB";
const total = (rows: z.infer<typeof sizeSchema>[]): number =>
  rows.reduce((sum, item) => sum + item.bytes, 0);
const statusKey = ["admin-retention", "status"] as const;
const hours = Array.from({ length: 24 }, (_, hour) => hour);
const timeLabel = (hour: number): string =>
  String(hour).padStart(2, "0") + ":00";

export function RetentionPage(): ReactElement {
  const queryClient = useQueryClient();
  const [downloadError, setDownloadError] = useState(false);
  const status = useQuery({
    queryKey: statusKey,
    queryFn: () => apiJson(endpoint + "/status", statusSchema),
    refetchInterval: (query) => (query.state.data?.active ? 2000 : 10000),
    retry: false,
  });
  const current = status.data?.history[0];
  const preview = useQuery({
    queryKey: [
      "admin-retention",
      "preview",
      status.data?.settings.days,
      current?.id,
      current?.status,
    ],
    queryFn: () => apiJson(endpoint + "/preview", previewSchema),
    enabled: !!status.data && !status.data.active,
    retry: false,
  });
  const before = preview.data?.databases;
  const after = preview.data?.estimatedAfter;
  const settings = status.data?.settings;
  const save = useMutation({
    mutationFn: (value: z.infer<typeof settingsSchema>) =>
      apiJson(endpoint + "/settings", settingsSchema, {
        method: "PUT",
        body: value,
      }),
    onSuccess: (saved) =>
      queryClient.setQueryData<z.infer<typeof statusSchema>>(
        statusKey,
        (current) => (current ? { ...current, settings: saved } : current),
      ),
  });
  const start = useMutation({
    mutationFn: () =>
      apiJson(endpoint + "/runs", z.object({ id: z.string() }), {
        method: "POST",
      }),
    onSuccess: () => status.refetch(),
  });
  const busy = !!status.data?.active || start.isPending;

  async function download(id: string, filename?: string): Promise<void> {
    setDownloadError(false);
    try {
      const response = await apiFetch(
        endpoint +
          "/runs/" +
          id +
          (filename ? "/files/" + encodeURIComponent(filename) : "/download"),
      );
      if (!response.ok) throw new Error();
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? "pbl6-archive-" + id + ".zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError(true);
    }
  }

  return (
    <section className="retention-page">
      <header className="retention-heading">
        <div>
          <h1>Lưu trữ dữ liệu</h1>
          <p>
            {settings
              ? `Tự lưu toàn bộ hồ sơ đủ điều kiện đã quá ${settings.days} ngày.`
              : "Lưu hồ sơ đã đóng để tra cứu bằng CSV."}
          </p>
        </div>
        <Button
          type="button"
          disabled={busy || !settings}
          isLoading={start.isPending}
          onClick={() => start.mutate()}
        >
          Lưu trữ ngay
        </Button>
      </header>
      {busy && (
        <p role="status">Đang xuất và kiểm tra file trước khi dọn từng lô.</p>
      )}
      {start.isError && <p role="alert">Không bắt đầu được lần lưu trữ.</p>}
      {status.isPending && <p role="status">Đang tải cấu hình…</p>}
      {status.isError && (
        <p role="alert">
          Tính năng lưu trữ không khả dụng trên môi trường này.
        </p>
      )}
      {settings && (
        <>
          <section
            className="retention-card"
            aria-labelledby="retention-preview"
          >
            <h2 id="retention-preview">Tổng dung lượng</h2>
            <dl className="retention-totals">
              <div>
                <dt>Trước lưu trữ</dt>
                <dd>{before ? mib(total(before)) : "—"}</dd>
              </div>
              <div>
                <dt>Dự kiến sau lưu trữ</dt>
                <dd>{after ? mib(total(after)) : "—"}</dd>
              </div>
            </dl>
            <p className="retention-caption">
              {busy
                ? "Đang lưu trữ. Dự báo sẽ cập nhật khi hoàn tất."
                : preview.isError
                  ? "Chưa tính được dung lượng dự kiến."
                  : preview.isFetching
                    ? "Đang tính dung lượng dự kiến…"
                    : "Ước tính trên dữ liệu hiện tại sau khi PostgreSQL thu hồi dung lượng."}
            </p>
            <details className="retention-detail">
              <summary>Xem chi tiết</summary>
              {before && (
                <table
                  className="retention-size-table"
                  aria-label="Dung lượng từng DB"
                >
                  <thead>
                    <tr>
                      <th scope="col">Cơ sở dữ liệu</th>
                      <th scope="col">Trước</th>
                      <th scope="col">Dự kiến sau</th>
                    </tr>
                  </thead>
                  <tbody>
                    {before.map((item) => {
                      const estimate = after?.find(
                        (entry) => entry.database === item.database,
                      );
                      return (
                        <tr key={item.database}>
                          <th scope="row">
                            {databaseLabels[item.database] ?? item.database}
                          </th>
                          <td>{mib(item.bytes)}</td>
                          <td>{estimate ? mib(estimate.bytes) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {after && (
                <p className="retention-caption">
                  PostgreSQL có thể tái sử dụng phần trống trước khi file trên
                  đĩa nhỏ lại.
                </p>
              )}
              {preview.isError && (
                <p role="alert">Không tính được số lượng ứng viên.</p>
              )}
              {preview.isFetching && (
                <p role="status">Đang kiểm tra dữ liệu…</p>
              )}
              {preview.data && (
                <>
                  <h3>Dữ liệu đủ điều kiện hiện tại</h3>
                  <p>
                    Mốc lưu trữ · {dates.format(new Date(preview.data.cutoff))}
                  </p>
                  <div className="retention-grid">
                    {preview.data.candidates.map((item) => (
                      <div key={item.key}>
                        <span>{labels[item.key] ?? item.key}</span>
                        <strong>{numeric.format(item.rows)}</strong>
                      </div>
                    ))}
                  </div>
                  <p>
                    Tài khoản khách hàng và dữ liệu đối soát được giữ. CSV của
                    hồ sơ đã đóng gồm thông tin hành khách gắn với đơn. Sự kiện
                    đã gửi quá hạn chờ cơ chế phát lại từ kho (
                    {numeric.format(
                      preview.data.publishedOutboxOlderThanCutoff,
                    )}{" "}
                    dòng).
                  </p>
                </>
              )}
            </details>
          </section>
          <section
            className="retention-card"
            aria-labelledby="retention-history"
          >
            <h2 id="retention-history">Lịch sử lưu trữ</h2>
            {!status.data?.history.length && <p>Chưa có lần chạy.</p>}
            {downloadError && <p role="alert">Không tải được file lưu trữ.</p>}
            {status.data?.history.map((run) => (
              <details key={run.id}>
                <summary>
                  {dates.format(new Date(run.startedAt))} ·{" "}
                  {statuses[run.status] ?? run.status}
                </summary>
                {run.error && <p role="alert">{run.error}</p>}
                {run.after.length > 0 && (
                  <p>
                    Đo thực tế · Trước {mib(total(run.before))} · Sau{" "}
                    {mib(total(run.after))}
                  </p>
                )}
                {run.files.length > 0 && run.status !== "running" && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void download(run.id)}
                  >
                    Tải toàn bộ CSV (.zip)
                  </Button>
                )}
                {run.files.length > 0 && (
                  <details>
                    <summary>
                      {numeric.format(run.files.length)} file CSV
                    </summary>
                    <ul className="retention-files">
                      {run.files.map((file) => (
                        <li key={file.name}>
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => void download(run.id, file.name)}
                          >
                            Tải {file.name}
                          </Button>
                          <span>
                            {numeric.format(file.rows)} dòng · {mib(file.bytes)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </details>
            ))}
          </section>
          <details className="retention-card">
            <summary>
              Lịch tự động ·{" "}
              {settings.enabled
                ? timeLabel(settings.hour) + " hằng ngày"
                : "Đang tắt"}
            </summary>
            <fieldset className="retention-form" disabled={save.isPending}>
              <label className="retention-toggle">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(event) =>
                    save.mutate({ ...settings, enabled: event.target.checked })
                  }
                />
                Bật lịch tự động
              </label>
              <label>
                Giờ chạy (Việt Nam)
                <select
                  value={settings.hour}
                  onChange={(event) =>
                    save.mutate({
                      ...settings,
                      hour: Number(event.target.value),
                    })
                  }
                >
                  {hours.map((hour) => (
                    <option key={hour} value={hour}>
                      {timeLabel(hour)}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
            {save.isPending && <p role="status">Đang lưu lịch…</p>}
            {save.isError && <p role="alert">Không lưu được lịch tự động.</p>}
          </details>
        </>
      )}
    </section>
  );
}
