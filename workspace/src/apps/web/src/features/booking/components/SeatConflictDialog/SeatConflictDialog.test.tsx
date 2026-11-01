import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { expect, it, vi } from "vitest";

import { SeatConflictDialog } from "@/features/booking/components/SeatConflictDialog/SeatConflictDialog";

it("uses safe generic conflict recovery when no server ID resolves to a known code", async () => {
  const close = vi.fn();
  const choose = vi.fn();
  render(
    <MemoryRouter>
      <SeatConflictDialog
        open
        codes={[]}
        resultsPath="/trips"
        onClose={close}
        onChooseAgain={choose}
        onFocusReturn={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(screen.getByRole("dialog")).toHaveAccessibleName(
    "Vị trí vừa được chọn",
  );
  expect(screen.getByText("CẬP NHẬT TÌNH TRẠNG GHẾ")).toBeVisible();
  expect(screen.getByText(/trải nghiệm chuyến đi tốt nhất/)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Chọn lại ghế" }));
  expect(choose).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
  expect(close).toHaveBeenCalledOnce();
});

it("renders the exact conflicted-seat status hierarchy", () => {
  render(
    <MemoryRouter>
      <SeatConflictDialog
        open
        codes={["B02"]}
        resultsPath="/trips"
        onClose={vi.fn()}
        onChooseAgain={vi.fn()}
        onFocusReturn={vi.fn()}
      />
    </MemoryRouter>,
  );
  expect(
    screen.getByRole("dialog", {
      name: "Vị trí B02 đã được chọn",
    }),
  ).toBeVisible();
  const status = screen.getByRole("listitem");
  expect(status).toHaveTextContent("B02");
  expect(status.querySelector("strong + span strong")).toHaveTextContent(
    "Không còn khả dụng",
  );
  expect(status.querySelector("small")).toHaveTextContent(
    "Vui lòng chọn vị trí ghế trống khác",
  );
});
