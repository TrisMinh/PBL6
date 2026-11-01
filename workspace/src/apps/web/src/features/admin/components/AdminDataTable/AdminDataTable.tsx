import {
  type Key,
  type KeyboardEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { Link } from "react-router";

import viewIcon from "@/assets/admin/view.svg";
import { Button } from "@/shared/ui/Button/Button";

import "./AdminDataTable.css";

export interface AdminDataColumn<T> {
  key: string;
  header: string;
  render: (item: T) => ReactNode;
}

export interface AdminDataAction<T> {
  key: string;
  label: string | ((item: T) => string);
  onSelect: (item: T) => void;
}

export interface AdminDataTableProps<T> {
  caption: string;
  columns: readonly AdminDataColumn<T>[];
  items: readonly T[];
  getRowKey: (item: T) => Key;
  getRowHref?: (item: T) => string;
  actions?: readonly AdminDataAction<T>[];
  actionsHeader?: string;
  variant?: "default" | "figma";
}

function resolveActionLabel<T>(action: AdminDataAction<T>, item: T): string {
  return typeof action.label === "function" ? action.label(item) : action.label;
}

function stopPointerPropagation(event: PointerEvent<HTMLButtonElement>): void {
  event.stopPropagation();
}

function stopKeyboardPropagation(
  event: KeyboardEvent<HTMLButtonElement>,
): void {
  event.stopPropagation();
}

interface RowActionsProps<T> {
  actions: readonly AdminDataAction<T>[];
  item: T;
}

interface TableHeadProps<T> {
  actionsHeader: string;
  columns: readonly AdminDataColumn<T>[];
  hasActions: boolean;
  hasView: boolean;
}

function TableHead<T>({
  actionsHeader,
  columns,
  hasActions,
  hasView,
}: TableHeadProps<T>): ReactElement {
  return (
    <thead className="admin-data-table__head">
      <tr>
        {columns.map((column) => (
          <th key={column.key} scope="col">
            {column.header}
          </th>
        ))}
        {hasActions && <th scope="col">{actionsHeader}</th>}
        {hasView && (
          <th scope="col">
            <span className="admin-data-table__caption">Chi tiết</span>
          </th>
        )}
      </tr>
    </thead>
  );
}

function RowActions<T>({ actions, item }: RowActionsProps<T>): ReactElement {
  return (
    <div className="admin-data-table__actions">
      {actions.map((action) => {
        const label = resolveActionLabel(action, item);
        return (
          <Button
            aria-label={label}
            key={action.key}
            onClick={(event) => {
              event.stopPropagation();
              action.onSelect(item);
            }}
            onKeyDown={stopKeyboardPropagation}
            onPointerDown={stopPointerPropagation}
            type="button"
            variant="ghost"
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

interface TableRowProps<T> {
  actions: readonly AdminDataAction<T>[];
  actionsHeader: string;
  columns: readonly AdminDataColumn<T>[];
  getRowHref?: (item: T) => string;
  item: T;
  variant: "default" | "figma";
}

function TableRow<T>({
  actions,
  actionsHeader,
  columns,
  getRowHref,
  item,
  variant,
}: TableRowProps<T>): ReactElement {
  const href = getRowHref?.(item);
  return (
    <tr className="admin-data-table__row">
      {columns.map((column, columnIndex) => (
        <td className="admin-data-table__cell" key={column.key}>
          <span aria-hidden="true" className="admin-data-table__mobile-label">
            {column.header}
          </span>
          <div className="admin-data-table__value">
            {columnIndex === 0 && href ? (
              <Link className="admin-data-table__row-link" to={href}>
                {column.render(item)}
              </Link>
            ) : (
              column.render(item)
            )}
          </div>
        </td>
      ))}
      {actions.length > 0 && (
        <td className="admin-data-table__cell admin-data-table__cell--actions">
          <span aria-hidden="true" className="admin-data-table__mobile-label">
            {actionsHeader}
          </span>
          <RowActions actions={actions} item={item} />
        </td>
      )}
      {variant === "figma" && href && (
        <td className="admin-data-table__cell admin-data-table__view">
          <Link to={href}>
            <img src={viewIcon} alt="" width={16} height={16} /> Xem chi tiết
          </Link>
        </td>
      )}
    </tr>
  );
}

export function AdminDataTable<T>({
  actions = [],
  actionsHeader = "Thao tác",
  caption,
  columns,
  getRowHref,
  getRowKey,
  items,
  variant = "default",
}: AdminDataTableProps<T>): ReactElement {
  return (
    <table className={`admin-data-table admin-data-table--${variant}`}>
      <caption className="admin-data-table__caption">{caption}</caption>
      <TableHead
        actionsHeader={actionsHeader}
        columns={columns}
        hasActions={actions.length > 0}
        hasView={variant === "figma" && Boolean(getRowHref)}
      />
      <tbody className="admin-data-table__body">
        {items.map((item) => (
          <TableRow
            actions={actions}
            actionsHeader={actionsHeader}
            columns={columns}
            getRowHref={getRowHref}
            item={item}
            variant={variant}
            key={getRowKey(item)}
          />
        ))}
      </tbody>
    </table>
  );
}
