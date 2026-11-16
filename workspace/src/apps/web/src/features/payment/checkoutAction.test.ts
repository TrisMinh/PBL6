import { afterEach, expect, it, vi } from "vitest";
import { submitCheckoutAction } from "./checkoutAction";

afterEach(() => vi.restoreAllMocks());
const action = {
  type: "FORM_POST",
  actionUrl: "https://pay-sandbox.sepay.vn/v1/checkout/init",
  order_amount: "300000",
  merchant: "TEST",
  currency: "VND",
  operation: "PURCHASE",
  order_description: "BLUE chuyến đi",
  order_invoice_number: "PAY-123",
  payment_method: "BANK_TRANSFER",
  signature: "signed-by-backend",
  success_url: "https://blue.example/payment/sepay/return?bookingId=test",
};

it("posts the backend-signed fields in order to SePay and excludes transport metadata", () => {
  const submit = vi
    .spyOn(HTMLFormElement.prototype, "submit")
    .mockImplementation(function (this: HTMLFormElement) {
      expect(this.method).toBe("post");
      expect(this.action).toBe(action.actionUrl);
      expect(document.body.contains(this)).toBe(true);
      const data = new FormData(this);
      expect(data.get("order_amount")).toBe("300000");
      expect(data.get("signature")).toBe(action.signature);
      expect(data.get("order_description")).toBe("BLUE chuyến đi");
      expect(data.has("type")).toBe(false);
      expect(data.has("actionUrl")).toBe(false);
      expect(data.has("secretKey")).toBe(false);
      expect([...data.keys()].slice(0, 4)).toEqual([
        "order_amount",
        "merchant",
        "currency",
        "operation",
      ]);
    });
  submitCheckoutAction({ ...action, secretKey: "must-not-leak" });
  expect(submit).toHaveBeenCalledOnce();
  expect(document.querySelector("form")).toBeNull();
});

it.each([
  "https://evil.example/collect",
  "javascript:alert(1)",
  "http://pay.sepay.vn/v1/checkout/init",
])("rejects unapproved form target %s", (actionUrl) => {
  const submit = vi
    .spyOn(HTMLFormElement.prototype, "submit")
    .mockImplementation(() => {});
  expect(() => submitCheckoutAction({ ...action, actionUrl })).toThrow();
  expect(submit).not.toHaveBeenCalled();
});
