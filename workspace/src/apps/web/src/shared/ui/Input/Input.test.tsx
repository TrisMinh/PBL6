import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Input } from "@/shared/ui/Input/Input";

describe("Input", () => {
  it("Input with an error links its label and announces the error description", () => {
    render(
      <Input
        error="Nhập địa chỉ email hợp lệ."
        id="contact-email"
        label="Email liên hệ"
        type="email"
      />,
    );

    const input = screen.getByLabelText("Email liên hệ");
    expect(input).toHaveAttribute("id", "contact-email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nhập địa chỉ email hợp lệ.",
    );
    expect(input).toHaveAccessibleDescription("Nhập địa chỉ email hợp lệ.");
  });

  it("Input without an explicit id generates unique label targets without errors", () => {
    render(
      <>
        <Input label="Họ tên" />
        <Input label="Số điện thoại" />
      </>,
    );

    const nameInput = screen.getByRole("textbox", { name: "Họ tên" });
    const phoneInput = screen.getByRole("textbox", { name: "Số điện thoại" });
    expect(nameInput.id).not.toBe("");
    expect(phoneInput.id).not.toBe(nameInput.id);
    expect(nameInput).toHaveAttribute("aria-invalid", "false");
    expect(nameInput).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Input preserves native props and forwards user changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Input
        autoComplete="tel"
        defaultValue="090"
        inputMode="tel"
        label="Số điện thoại"
        maxLength={4}
        name="contactPhone"
        onChange={onChange}
        required
        type="tel"
      />,
    );

    const input = screen.getByRole("textbox", { name: "Số điện thoại" });
    expect(input).toHaveValue("090");
    expect(input).toHaveAttribute("type", "tel");
    expect(input).toHaveAttribute("name", "contactPhone");
    expect(input).toHaveAttribute("autocomplete", "tel");
    expect(input).toHaveAttribute("inputmode", "tel");
    expect(input).toHaveAttribute("maxlength", "4");
    expect(input).toBeRequired();
    await user.clear(input);
    await user.type(input, "0909");
    expect(input).toHaveValue("0909");
    expect(onChange).toHaveBeenCalled();
  });

  it.each([
    { disabled: true, readOnly: false },
    { disabled: false, readOnly: true },
  ])(
    "Input with $disabled disabled and $readOnly readOnly prevents editing",
    async (props) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <Input
          {...props}
          defaultValue="Nguyễn An"
          label="Họ tên"
          onChange={onChange}
        />,
      );

      const input = screen.getByRole("textbox", { name: "Họ tên" });
      await user.type(input, " mới");
      expect(input).toHaveValue("Nguyễn An");
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  it("Input retains caller descriptions when errors appear and clear", () => {
    const { rerender } = render(
      <>
        <p id="email-hint">Dùng email để nhận vé.</p>
        <Input
          aria-describedby="email-hint"
          error="Nhập email hợp lệ."
          id="email"
          label="Email"
        />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("aria-describedby", "email-hint email-error");
    expect(input).toHaveAccessibleDescription(
      "Dùng email để nhận vé. Nhập email hợp lệ.",
    );

    rerender(
      <>
        <p id="email-hint">Dùng email để nhận vé.</p>
        <Input aria-describedby="email-hint" id="email" label="Email" />
      </>,
    );
    expect(input).toHaveAttribute("aria-describedby", "email-hint");
    expect(input).toHaveAccessibleDescription("Dùng email để nhận vé.");
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("Input keeps the caller className alongside its canonical control class", () => {
    render(<Input className="contact-form__input" label="Email" />);

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveClass(
      "field__control",
      "contact-form__input",
    );
  });
});

it("forwards a native React 19 input ref", () => {
  const inputRef = createRef<HTMLInputElement>();
  render(<Input label="Ngày đi" ref={inputRef} />);
  expect(inputRef.current).toBe(
    screen.getByRole("textbox", { name: "Ngày đi" }),
  );
});
