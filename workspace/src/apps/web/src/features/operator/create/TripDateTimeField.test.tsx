import { useState, type ReactElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { TripDateTimeField } from "./TripDateTimeField";

function Form(): ReactElement {
  const [value, setValue] = useState("2027-03-24T08:00");
  return (
    <form>
      <TripDateTimeField label="Khởi hành" value={value} onChange={setValue} />
      <output>{value}</output>
    </form>
  );
}
afterEach(cleanup);
describe("24-hour trip time", () => {
  it("keeps the selected date when entering afternoon time without AM/PM", () => {
    render(<Form />);
    const hour = screen.getByLabelText("Khởi hành - Giờ");
    const minute = screen.getByLabelText("Khởi hành - Phút");
    fireEvent.change(hour, { target: { value: "14" } });
    fireEvent.change(minute, { target: { value: "30" } });
    expect(screen.getByRole("status")).toHaveTextContent("2027-03-24T14:30");
    expect(hour).toBeValid();
    fireEvent.change(screen.getByLabelText("Khởi hành - Ngày"), {
      target: { value: "2027-03-25" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("2027-03-25T14:30");
  });
  it("accepts midnight and 23:59 and rejects out-of-range input", () => {
    render(<Form />);
    const hour = screen.getByLabelText("Khởi hành - Giờ");
    const minute = screen.getByLabelText("Khởi hành - Phút");
    for (const [h, m] of [
      ["00", "00"],
      ["23", "59"],
    ]) {
      fireEvent.change(hour, { target: { value: h } });
      fireEvent.change(minute, { target: { value: m } });
      expect(hour).toBeValid();
      expect(minute).toBeValid();
      expect(screen.getByRole("status")).toHaveTextContent(
        `2027-03-24T${h}:${m}`,
      );
    }
    fireEvent.change(hour, { target: { value: "24" } });
    expect(hour).toBeInvalid();
    fireEvent.change(minute, { target: { value: "60" } });
    expect(minute).toBeInvalid();
  });
  it("pads single digits after leaving an input", () => {
    render(<Form />);
    const hour = screen.getByLabelText("Khởi hành - Giờ");
    const minute = screen.getByLabelText("Khởi hành - Phút");
    fireEvent.change(hour, { target: { value: "8" } });
    fireEvent.blur(hour);
    fireEvent.change(minute, { target: { value: "5" } });
    fireEvent.blur(minute);
    expect(screen.getByRole("status")).toHaveTextContent("2027-03-24T08:05");
  });
});
