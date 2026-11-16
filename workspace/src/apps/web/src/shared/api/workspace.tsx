import { BrandLoading } from "@/shared/ui/BrandLogo/BrandLoading";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactElement, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";
import { z } from "zod";
import { useAccountSession } from "@/features/auth/hooks/useAccountSession";
import { Button } from "@/shared/ui/Button/Button";
import { apiJson } from "./client";
import { ApiFailure } from "./ResourcePage";
import type { ApiRow } from "./fields";
import "./live.css";

export function ApiWorkspace({
  title,
  children,
  operator = false,
}: {
  title: string;
  children: ReactNode;
  operator?: boolean;
}): ReactElement {
  const { session, isHydrated, revoke } = useAccountSession();
  const location = useLocation();
  if (!isHydrated) return <BrandLoading compact title="Đang kiểm tra phiên…" />;
  if (!session)
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  const links = operator
    ? [
        ["/operator/trips", "Chuyến"],
        ["/operator/vehicles", "Xe"],
        ["/operator/drivers", "Tài xế"],
        ["/operator/routes", "Tuyến"],
        ["/operator/organization", "Nhà xe"],
        ["/operator/refund-requests", "Đối soát"],
      ]
    : [
        ["/account/tickets", "Vé và đơn"],
        ["/account/profile", "Hồ sơ"],
        ["/account/notifications", "Thông báo"],
        ["/admin/organizations", "Tổ chức"],
        ["/admin/staff", "Người dùng"],
      ];
  return (
    <section className="live-api">
      <nav>
        {links.map(([to, label]) => (
          <Link key={to} to={to}>
            {label}
          </Link>
        ))}
        <Button variant="secondary" onClick={revoke}>
          Đăng xuất
        </Button>
      </nav>
      <h1>{title}</h1>
      {children}
    </section>
  );
}
export interface FormField {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "email"
    | "date"
    | "datetime-local"
    | "checkbox"
    | "select";
  required?: boolean;
  min?: number;
  step?: string;
  help?: string;
  options?: { value: string; label: string }[];
  rows?: FormField[];
}
function FormControl({
  field,
  value,
  change,
}: {
  field: FormField;
  value: unknown;
  change: (value: unknown) => void;
}): ReactElement {
  if (field.rows) {
    const rows = Array.isArray(value) ? (value as ApiRow[]) : [];
    return (
      <fieldset>
        <legend>{field.label}</legend>
        {rows.map((row, i) => (
          <fieldset key={i}>
            <legend>Dòng {i + 1}</legend>
            {field.rows?.map((child) => (
              <FormControl
                key={child.name}
                field={child}
                value={row[child.name]}
                change={(next) =>
                  change(
                    rows.map((r, index) =>
                      index === i ? { ...r, [child.name]: next } : r,
                    ),
                  )
                }
              />
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() => change(rows.filter((_, index) => index !== i))}
            >
              Bỏ dòng
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => change([...rows, {}])}
        >
          Thêm dòng
        </Button>
      </fieldset>
    );
  }
  return (
    <label>
      {field.label}
      {field.type === "select" ? (
        <select
          required={field.required}
          value={String(value ?? "")}
          onChange={(e) => change(e.target.value)}
        >
          <option value="">Chọn…</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type ?? "text"}
          required={field.required}
          min={field.min}
          step={field.step}
          {...(field.type === "checkbox"
            ? {
                checked: value === true,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  change(e.target.checked),
              }
            : {
                value: String(value ?? ""),
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  change(
                    field.type === "number"
                      ? e.target.value === ""
                        ? ""
                        : Number(e.target.value)
                      : e.target.value,
                  ),
              })}
        />
      )}
      {field.help && <small>{field.help}</small>}
    </label>
  );
}
export function ApiForm({
  title,
  endpoint,
  method = "POST",
  fields,
  initial = {},
  prepare,
  onSaved,
  submitLabel = "Lưu",
}: {
  title: string;
  endpoint: string;
  method?: "POST" | "PUT" | "PATCH";
  fields: FormField[];
  initial?: ApiRow;
  prepare?: (values: ApiRow) => unknown;
  onSaved?: (result: unknown) => void;
  submitLabel?: string;
}): ReactElement {
  const [values, setValues] = useState<ApiRow>(initial);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (input: ApiRow) => {
      const body = prepare ? prepare(input) : input;
      const payload = JSON.stringify(body);
      if (!attempt.current || attempt.current.payload !== payload)
        attempt.current = { payload, key: crypto.randomUUID() };
      return apiJson(endpoint, z.unknown(), {
        method,
        body,
        idempotencyKey: attempt.current.key,
      });
    },
    retry: false,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ["live-api"] });
      onSaved?.(result);
    },
  });
  return (
    <section>
      <h2>{title}</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(values);
        }}
      >
        <fieldset disabled={mutation.isPending}>
          {fields.map((field) => (
            <FormControl
              key={field.name}
              field={field}
              value={values[field.name]}
              change={(value) => {
                mutation.reset();
                setValues((previous) => ({ ...previous, [field.name]: value }));
              }}
            />
          ))}
          <Button type="submit" isLoading={mutation.isPending}>
            {submitLabel}
          </Button>
        </fieldset>
      </form>
      {mutation.isError && <ApiFailure error={mutation.error} />}
      {mutation.isSuccess && <p role="status">Đã lưu yêu cầu thành công.</p>}
    </section>
  );
}
