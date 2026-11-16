import { ApiError } from "@/shared/api/error";

const fields = new Set([
  "order_amount",
  "merchant",
  "currency",
  "operation",
  "order_description",
  "order_invoice_number",
  "customer_id",
  "payment_method",
  "success_url",
  "error_url",
  "cancel_url",
  "lang",
  "signature",
]);

/** Only backend-signed fields go to SePay. Secrets never enter the browser. */
export function submitCheckoutAction(action: Record<string, string>): void {
  if (
    action.type !== "FORM_POST" ||
    ![
      "https://pay-sandbox.sepay.vn/v1/checkout/init",
      "https://pay.sepay.vn/v1/checkout/init",
    ].includes(action.actionUrl) ||
    !action.signature ||
    !action.merchant ||
    action.currency !== "VND"
  )
    throw new ApiError(
      "INVALID_CHECKOUT",
      0,
      "Thông tin cổng thanh toán không hợp lệ.",
    );
  const form = document.createElement("form");
  form.method = "POST";
  form.action = action.actionUrl;
  form.hidden = true;
  for (const [name, value] of Object.entries(action)) {
    if (!fields.has(name)) continue;
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.append(input);
  }
  document.body.append(form);
  try {
    HTMLFormElement.prototype.submit.call(form);
  } finally {
    form.remove();
  }
}

export const useSePay = import.meta.env.VITE_PAYMENT_PROVIDER !== "vnpay";

export const livePaymentPath = (bookingId: string): string =>
  `/payment/${bookingId}/${useSePay ? "sepay" : "vnpay"}`;
