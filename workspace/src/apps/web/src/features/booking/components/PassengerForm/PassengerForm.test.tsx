import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { PassengerForm } from "@/features/booking/components/PassengerForm/PassengerForm";
import type { PassengerFormValues } from "@/features/booking/schemas/passenger.schema";

const SEATS = [
  { id: "trip:A01", code: "A01" },
  { id: "trip:B02", code: "B02" },
];
function blank(): PassengerFormValues {
  return {
    contact: { fullName: "", email: "", phone: "" },
    passengers: SEATS.map((seat) => ({
      seatId: seat.id,
      fullName: "",
      phone: "",
    })),
  };
}
async function fill(): Promise<void> {
  await userEvent.type(
    screen.getByLabelText("Họ và tên người liên hệ"),
    "  Khách Liên Hệ  ",
  );
  await userEvent.type(
    screen.getByLabelText("Email nhận vé"),
    "  test+mock@example.invalid  ",
  );
  await userEvent.type(
    screen.getByLabelText("Số điện thoại người liên hệ"),
    "  0912345678  ",
  );
  for (const seat of SEATS)
    await userEvent.type(
      screen.getByLabelText(`Họ và tên (ghế ${seat.code})`),
      `  Khách ${seat.code}  `,
    );
}
describe("PassengerForm accessibility and canonical values", () => {
  it("renders labeled stable seat fieldsets, hidden IDs, contact and read-only trusted pickup", () => {
    render(
      <PassengerForm
        seats={SEATS}
        initialValues={blank()}
        pickup="Bến thử nghiệm"
        onSubmit={vi.fn()}
      />,
    );
    for (const seat of SEATS) {
      const group = screen.getByRole("group", {
        name: `Ghế ${seat.code} · Thông tin hành khách`,
      });
      expect(
        within(group).getByLabelText(`Họ và tên (ghế ${seat.code})`),
      ).toBeRequired();
      expect(group.querySelector('input[type="hidden"]')).toHaveValue(seat.id);
    }
    expect(screen.getByLabelText("Vị trí đón")).toHaveValue("Bến thử nghiệm");
    expect(screen.getByLabelText("Vị trí đón")).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Ghi chú cho nhà xe")).toHaveValue(
      "Không có yêu cầu đặc biệt",
    );
    expect(screen.getByRole("group", { name: "Điểm đón" })).toBeVisible();
    expect(
      screen.getByRole("group", {
        name: "Nhận vé và yêu cầu cho nhà xe",
      }),
    ).toBeVisible();
    expect(
      document.querySelectorAll(
        ".passenger-form__icon, .passenger-form__chevron",
      ),
    ).toHaveLength(8);
  });
  it("blocks empty submit with safe alerts linked to controls and focuses the first invalid field", async () => {
    const submit = vi.fn();
    render(
      <PassengerForm
        seats={SEATS}
        initialValues={blank()}
        pickup="Bến thử nghiệm"
        onSubmit={submit}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    await waitFor(() =>
      expect(screen.getAllByRole("alert").length).toBeGreaterThan(3),
    );
    const first = screen.getByLabelText("Họ và tên (ghế A01)");
    expect(first).toHaveAttribute("aria-invalid", "true");
    const errorId = first.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId ?? "")).toHaveAttribute(
      "role",
      "alert",
    );
    expect(first).toHaveFocus();
    expect(submit).not.toHaveBeenCalled();
  });
  it("emits trimmed canonical contact and exactly one named row per current seat", async () => {
    const submit = vi.fn();
    render(
      <PassengerForm
        seats={SEATS}
        initialValues={blank()}
        pickup="Bến thử nghiệm"
        onSubmit={submit}
      />,
    );
    await fill();
    await userEvent.click(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith({
      contact: {
        fullName: "Khách Liên Hệ",
        email: "test+mock@example.invalid",
        phone: "0912345678",
      },
      passengers: SEATS.map((seat) => ({
        seatId: seat.id,
        fullName: `Khách ${seat.code}`,
        phone: undefined,
      })),
    });
  });
  it("restores values by supplied seat identity and locks native controls while pending", () => {
    const values = blank();
    values.contact = {
      fullName: "Khách Liên Hệ",
      email: "test+mock@example.invalid",
      phone: "0912345678",
    };
    values.passengers[0].fullName = "Khách Đã Lưu";
    render(
      <PassengerForm
        seats={SEATS}
        initialValues={values}
        pickup="Bến thử nghiệm"
        onSubmit={vi.fn()}
        isPending
      />,
    );
    expect(screen.getByLabelText("Họ và tên (ghế A01)")).toHaveValue(
      "Khách Đã Lưu",
    );
    expect(screen.getByLabelText("Email nhận vé")).toHaveValue(
      "test+mock@example.invalid",
    );
    for (const input of screen.getAllByRole("textbox"))
      expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang xử lý" })).toBeDisabled();
  });
  it("rejects invalid email/contact phone and optional passenger phone, keeping entered values", async () => {
    const submit = vi.fn();
    render(
      <PassengerForm
        seats={SEATS}
        initialValues={blank()}
        pickup="Bến thử nghiệm"
        onSubmit={submit}
      />,
    );
    await fill();
    const email = screen.getByLabelText("Email nhận vé");
    await userEvent.clear(email);
    await userEvent.type(email, "invalid");
    await userEvent.type(
      screen.getByLabelText("Số điện thoại (ghế B02, không bắt buộc)"),
      "0212345678",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Xác nhận thông tin" }),
    );
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByLabelText("Họ và tên (ghế A01)")).toHaveValue(
      "  Khách A01  ",
    );
    expect(submit).not.toHaveBeenCalled();
  });
});
