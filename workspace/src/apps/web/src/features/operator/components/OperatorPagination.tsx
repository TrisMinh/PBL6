import type { ReactElement } from "react";
import { paginationWindow } from "./paginationWindow";
export function OperatorPagination({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}): ReactElement {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <footer className="operator-pagination">
      <p>
        Hiển thị {total ? (page - 1) * pageSize + 1 : 0}–
        {Math.min(page * pageSize, total)} trong {total} kết quả
      </p>
      <nav aria-label="Phân trang danh sách">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Trang trước"
        >
          ‹
        </button>
        {paginationWindow(page, pages).map((item) =>
          typeof item === "number" ? (
            <button
              type="button"
              key={item}
              aria-label={`Trang ${item}`}
              aria-current={page === item ? "page" : undefined}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ) : (
            <span key={item}>…</span>
          ),
        )}
        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Trang sau"
        >
          ›
        </button>
      </nav>
    </footer>
  );
}
