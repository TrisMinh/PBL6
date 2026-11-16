import { useId, useState, type ReactElement } from "react";
import { useMutation } from "@tanstack/react-query";
import { Tag } from "@phosphor-icons/react/dist/csr/Tag";
import { apiJson } from "@/shared/api/client";
import { ApiError } from "@/shared/api/error";
import {
  couponQuoteSchema,
  type CouponQuote,
} from "@/features/trips/api/coupons";
import { formatCurrencyVnd } from "@/shared/lib/formatCurrencyVnd";
import { keyFor } from "../repositories/backendBookingRepository";
import type { BookingDraft } from "../types/booking";
import { Button } from "@/shared/ui/Button/Button";
import "./CouponReview.css";

export function CouponReview({
  draft,
  coupon,
  locked,
  onChange,
  onPending,
}: {
  draft: BookingDraft;
  coupon?: CouponQuote;
  locked: boolean;
  onChange: (coupon: CouponQuote | undefined) => void;
  onPending: (pending: boolean) => void;
}): ReactElement {
  const id = useId();
  const [code, setCode] = useState(() => {
    if (coupon) return coupon.code;
    try {
      const choice = JSON.parse(
        sessionStorage.getItem("blue-coupon-choice") ?? "null",
      );
      return choice?.tripId === draft.tripId ? String(choice.code) : "";
    } catch {
      return "";
    }
  });
  const apply = useMutation({
    mutationFn: async () => {
      const meta = JSON.parse(
        sessionStorage.getItem(keyFor(draft.sessionId)) ?? "{}",
      );
      if (!meta.holdToken)
        throw new Error("Vui lòng chọn lại ghế để kiểm tra mã giảm giá.");
      return apiJson("/api/v1/coupons/quote", couponQuoteSchema, {
        method: "POST",
        body: { holdToken: meta.holdToken, code: code.trim() },
      });
    },
    retry: false,
    onMutate: () => onPending(true),
    onSuccess: (quote) => {
      onChange(quote);
      setCode(quote.code);
    },
    onSettled: () => onPending(false),
  });
  return (
    <div className="booking-coupon">
      <label htmlFor={id}>
        <Tag size={17} aria-hidden /> Mã giảm giá
      </label>
      <div className="booking-coupon__entry">
        <input
          id={id}
          value={code}
          maxLength={32}
          placeholder="Nhập mã ưu đãi"
          autoComplete="off"
          disabled={locked || apply.isPending || Boolean(coupon)}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            apply.reset();
          }}
        />
        {coupon ? (
          <Button
            type="button"
            variant="secondary"
            disabled={locked}
            onClick={() => {
              onChange(undefined);
              apply.reset();
            }}
          >
            Bỏ mã
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled={locked || !code.trim()}
            isLoading={apply.isPending}
            onClick={() => apply.mutate()}
          >
            Áp dụng
          </Button>
        )}
      </div>
      {coupon && (
        <p className="booking-coupon__success" role="status">
          Đã áp dụng {coupon.code} · Giảm {formatCurrencyVnd(coupon.discount)}
        </p>
      )}
      {apply.isError && (
        <p className="booking-coupon__error" role="alert">
          {apply.error instanceof ApiError || apply.error instanceof Error
            ? apply.error.message
            : "Chưa thể áp dụng mã. Vui lòng thử lại."}
        </p>
      )}
    </div>
  );
}
