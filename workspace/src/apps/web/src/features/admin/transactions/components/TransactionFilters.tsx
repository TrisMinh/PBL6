import { isMockApi } from "@/shared/api/config";
import { useQuery } from "@tanstack/react-query";
import { getLiveRows, liveQueryKey } from "@/shared/api/liveRequest";
import { Input } from "@/shared/ui/Input/Input";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, type ReactElement } from "react";
import { useSearchParams } from "react-router";
import searchIcon from "@/assets/admin/transaction-search.svg";
import {
  TRANSACTION_CONFIG,
  TRANSACTION_ORGANIZATIONS,
  type TransactionResource,
} from "../transactionConfig";

type FilterProps={resource:TransactionResource;disabled?:boolean;onSearch:()=>void};
export function TransactionFilters(props:FilterProps):ReactElement {
 return isMockApi ? <TransactionFilterControls {...props} organizations={TRANSACTION_ORGANIZATIONS}/> : <LiveTransactionFilters {...props}/>;
}
function LiveTransactionFilters(props:FilterProps):ReactElement {
 const query=useQuery({queryKey:liveQueryKey("admin-filter-organizations"),queryFn:({signal})=>getLiveRows("/api/v1/admin/organizations",signal)});
 return <TransactionFilterControls {...props} organizations={(query.data ?? []).map(o=>({id:String(o.id),label:String(o.name)}))}/>;
}
function TransactionFilterControls({resource,disabled=false,onSearch,organizations}:FilterProps & {organizations:readonly {id:string;label:string}[]}):ReactElement {
  const [params, setParams] = useSearchParams();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef(false);
  const config = TRANSACTION_CONFIG[resource];
  const [lookupQuery, setLookupQuery] = useState(params.get("query") ?? "");
  const rawDialog = params.get("dialog");
  const dialog = ["query", "org", "status"].includes(rawDialog ?? "")
    ? rawDialog
    : null;
  useEffect(() => {
    if (!disabled && !dialog && pendingFocus.current) {
      trigger.current?.focus();
      pendingFocus.current = false;
    }
  }, [disabled, dialog]);
  const title =
    dialog === "query"
      ? isMockApi
        ? "Tra cứu mẫu trong prototype"
        : "Tra cứu giao dịch"
      : dialog === "org"
        ? "Chọn nhà xe"
        : "Chọn trạng thái";
  const orgs = !isMockApi
    ? organizations
    : resource === "refunds"
      ? [
          TRANSACTION_ORGANIZATIONS[0],
          TRANSACTION_ORGANIZATIONS[2],
          TRANSACTION_ORGANIZATIONS[3],
          TRANSACTION_ORGANIZATIONS[4],
          TRANSACTION_ORGANIZATIONS[1],
        ]
      : organizations;
  const options =
    dialog === "query"
      ? [
          ["", "Không giới hạn mã"],
          [`${config.prefix}-260916-018`, `${config.prefix}-260916-018`],
          [`${config.prefix}-KHONG-TON-TAI`, `${config.prefix}-KHONG-TON-TAI`],
        ]
      : dialog === "org"
        ? [["", "Tất cả nhà xe"], ...orgs.map((item) => [item.id, item.label])]
        : [
            ["", "Tất cả trạng thái"],
            ...Object.entries(config.statuses).filter(
              ([key]) => key !== "cancelled",
            ),
          ];
  const close = (): void => {
    trigger.current ??= document.querySelector<HTMLButtonElement>(
      `.transaction-filters__field--${dialog}`,
    );
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("dialog");
      return next;
    });
  };
  const select = (value: string): void => {
    trigger.current ??= document.querySelector<HTMLButtonElement>(
      `.transaction-filters__field--${dialog}`,
    );
    const key =
      dialog === "query"
        ? "query"
        : dialog === "org"
          ? "organizationId"
          : "viewStatus";
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("dialog");
      next.delete("page");
      next.delete(key);
      if (key === "viewStatus") next.delete("status");
      if (value) next.set(key, value);
      return next;
    });
  };
  const open = (value: string, element: HTMLButtonElement): void => {
    trigger.current = element;
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("dialog", value);
      return next;
    });
  };
  const selectedStatus =
    Object.entries(config.statuses).find(
      ([key]) => key === params.get("viewStatus"),
    )?.[1] ?? "Tất cả trạng thái";
  const fields = [
    {
      key: "query",
      label: isMockApi ? "Mã tra cứu · chọn mẫu" : "Mã tra cứu",
      value: disabled ? config.placeholder : (params.get("query") ?? "\u200b"),
    },
    {
      key: "org",
      label: "Nhà xe",
      value:
        organizations.find((item) => item.id === params.get("organizationId"))
          ?.label ?? "Tất cả nhà xe",
    },
    { key: "status", label: "Trạng thái", value: selectedStatus },
  ];
  return (
    <>
      <div className="transaction-filters">
        {fields.map((field) => (
          <button
            aria-haspopup="dialog"
            className={`transaction-filters__field transaction-filters__field--${field.key}`}
            disabled={disabled}
            key={field.key}
            onClick={(event) => open(field.key, event.currentTarget)}
            type="button"
          >
            <span className="transaction-filters__label">{field.label}</span>
            <span className="transaction-filters__value">{field.value}</span>
          </button>
        ))}
        <button
          className="transaction-filters__search"
          disabled={disabled}
          onClick={onSearch}
          type="button"
        >
          <img src={searchIcon} alt="" width={18} height={18} />
          Tra cứu
        </button>
      </div>
      <Dialog.Root
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="transaction-filters__overlay" />
          <Dialog.Content
            aria-describedby={undefined}
            className="transaction-filters__dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (trigger.current?.disabled) pendingFocus.current = true;
              else trigger.current?.focus();
            }}
          >
            <Dialog.Title className="transaction-filters__dialog-title">
              {title}
            </Dialog.Title>
            {dialog === "query" && !isMockApi ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  select(lookupQuery.trim());
                }}
              >
                <Input
                  label="Mã giao dịch hoặc thông tin cần tìm"
                  value={lookupQuery}
                  onChange={(e) => setLookupQuery(e.target.value)}
                  maxLength={100}
                />
                <button className="transaction-filters__option" type="submit">
                  Áp dụng
                </button>
              </form>
            ) : (
              options.map(([value, label]) => (
                <button
                  className="transaction-filters__option"
                  key={value}
                  onClick={() => select(value ?? "")}
                  type="button"
                >
                  {label}
                </button>
              ))
            )}
            <button
              className="transaction-filters__option"
              onClick={close}
              type="button"
            >
              Đóng
            </button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
