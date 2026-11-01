import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type ReactElement } from "react";
import { z } from "zod";

import { liveApiJson as apiJson } from "@/shared/api/liveRequest";
import { ApiFailure } from "@/shared/api/ResourcePage";
import { Button } from "@/shared/ui/Button/Button";

const payoutSchema = z.object({
  id: z.string(),
  status: z.string(),
  payableAmount: z.number(),
});

/** POST /api/v1/admin/payouts: records an operator payout for a settlement period. */
export function LivePayoutCreate(): ReactElement {
  const client = useQueryClient();
  const [form, setForm] = useState({
    organizationId: "",
    periodStart: "",
    periodEnd: "",
    currency: "VND",
    payableAmount: "",
  });
  const mutation = useMutation({
    mutationFn: () =>
      apiJson("/api/v1/admin/payouts", payoutSchema, {
        method: "POST",
        idempotent: true,
        body: {
          organizationId: form.organizationId.trim(),
          periodStart: form.periodStart,
          periodEnd: form.periodEnd,
          currency: form.currency.trim().toUpperCase(),
          payableAmount: Number(form.payableAmount),
        },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["live-api"] });
    },
    retry: false,
  });
  const set =
    (key: keyof typeof form) =>
    (event: { target: { value: string } }): void =>
      setForm({ ...form, [key]: event.target.value });

  return (
    <details>
      <summary>Tạo chi trả cho nhà xe</summary>
      <form
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        <label>
          Mã tổ chức (UUID)
          <input
            required
            value={form.organizationId}
            onChange={set("organizationId")}
          />
        </label>
        <label>
          Từ ngày
          <input
            required
            type="date"
            value={form.periodStart}
            onChange={set("periodStart")}
          />
        </label>
        <label>
          Đến ngày
          <input
            required
            type="date"
            value={form.periodEnd}
            onChange={set("periodEnd")}
          />
        </label>
        <label>
          Tiền tệ
          <input
            required
            maxLength={3}
            value={form.currency}
            onChange={set("currency")}
          />
        </label>
        <label>
          Số tiền chi trả
          <input
            required
            min={1}
            step={1}
            type="number"
            value={form.payableAmount}
            onChange={set("payableAmount")}
          />
        </label>
        <Button isLoading={mutation.isPending} type="submit">
          Tạo chi trả
        </Button>
        {mutation.isSuccess ? (
          <p role="status">
            Đã tạo chi trả, trạng thái: {mutation.data.status}.
          </p>
        ) : null}
        {mutation.isError ? <ApiFailure error={mutation.error} /> : null}
      </form>
    </details>
  );
}
