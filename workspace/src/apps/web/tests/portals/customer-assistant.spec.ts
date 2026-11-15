import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("BLUE mascot opens a bounded, usable chat and keeps conversation across customer pages", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/explore");
  const launcher = page.getByRole("button", {
    name: "Hỏi BLUE",
    exact: true,
  });
  const heading = page.getByRole("heading", {
    name: "Khám phá điểm đến",
    exact: true,
  });
  const before = await heading.boundingBox();
  const robot = launcher.locator("img");
  const robotBefore = await robot.boundingBox();
  expect(robotBefore?.width).toBe(116);
  expect(robotBefore?.height).toBe(112);
  const launcherBefore = await launcher.boundingBox();
  const contentWidth = await page.evaluate(
    () => document.documentElement.clientWidth,
  );
  if (launcherBefore)
    expect(
      contentWidth - launcherBefore.x - launcherBefore.width,
    ).toBeLessThanOrEqual(32);
  await expect(page.locator(".blue-assistant")).toHaveCSS("right", "12px");
  await expect(launcher).toHaveCSS("border-top-width", "0px");
  await expect(launcher).toHaveCSS("box-shadow", "none");
  await launcher.click();
  expect(await robot.boundingBox()).toEqual(robotBefore);
  const chat = page.getByRole("dialog", { name: "BLUE • Trợ lý hành trình" });
  await expect(chat).toBeVisible();
  await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
  expect((await heading.boundingBox())?.x).toBe(before?.x);
  const input = chat.getByRole("textbox", { name: "Nhắn cho BLUE" });
  await expect(input).toBeFocused();
  await expect(
    chat.getByRole("button", { name: "Gửi tin nhắn" }),
  ).toBeDisabled();
  await chat.getByRole("button", { name: "Tra cứu vé", exact: true }).click();
  await expect(
    chat.getByRole("link", { name: "Tra cứu vé", exact: true }),
  ).toBeVisible();
  await input.fill("Sài Gòn đi Đà Lạt ngày mai, 2 người");
  await input.press("Enter");
  await expect(
    chat.getByRole("link", { name: "Xem chuyến phù hợp" }),
  ).toBeVisible();
  await page.screenshot({
    path: "../../../../docs/implementation/navigation-fix/blue-assistant-small.png",
    fullPage: false,
  });
  const small = await chat.boundingBox();
  await chat.getByRole("button", { name: "Mở rộng khung chat" }).click();
  await expect
    .poll(() =>
      chat.evaluate((el) =>
        el
          .getAnimations()
          .some((animation) => animation.playState === "running"),
      ),
    )
    .toBe(true);
  await expect
    .poll(async () => Math.round((await chat.boundingBox())?.width ?? 0))
    .toBe(900);
  const large = await chat.boundingBox();
  expect(await robot.boundingBox()).toEqual(robotBefore);
  expect(large?.width).toBeGreaterThan(small?.width ?? 0);
  expect(large?.height).toBeGreaterThan(small?.height ?? 0);
  expect(large?.width).toBe(900);
  if (large) {
    expect(Math.abs(large.x + large.width / 2 - 1920 / 2)).toBeLessThanOrEqual(
      16,
    );
    expect(Math.abs(large.y + large.height / 2 - 1080 / 2)).toBeLessThanOrEqual(
      1,
    );
  }
  expect(large?.width).toBeLessThan(1000);
  expect(large?.height).toBeLessThan(900);
  await page.setViewportSize({ width: 1280, height: 900 });
  const bounds = await chat.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  if (bounds) expect(bounds.x + bounds.width).toBeLessThanOrEqual(1280);
  await page.screenshot({
    path: "../../../../docs/implementation/navigation-fix/blue-assistant-expanded.png",
    fullPage: false,
  });
  const results = await new AxeBuilder({ page })
    .include(".blue-assistant")
    .analyze();
  expect(results.violations).toEqual([]);
  await chat.getByRole("button", { name: "Thu gọn khung chat" }).click();
  await expect
    .poll(() =>
      chat.evaluate((el) =>
        el
          .getAnimations()
          .some((animation) => animation.playState === "running"),
      ),
    )
    .toBe(true);
  await expect
    .poll(async () => Math.round((await chat.boundingBox())?.width ?? 0))
    .toBe(390);
  await expect(chat).toHaveCSS("position", "absolute");
  await expect(chat).toHaveCSS("width", "390px");
  await chat.getByRole("link", { name: "Xem chuyến phù hợp" }).click();
  await expect(page).toHaveURL(
    /originId=loc-hcm.*destinationId=loc-dalat.*passengerCount=2/,
  );
  await expect(chat.getByText(/Mình đã chuẩn bị tìm kiếm/)).toBeVisible();
  await input.press("Escape");
  await expect(chat).toHaveCount(0);
  await expect(launcher).toBeFocused();
  const closedRobot = await robot.boundingBox();
  await launcher.click();
  expect(await robot.boundingBox()).toEqual(closedRobot);
  await expect(chat.getByText(/Mình đã chuẩn bị tìm kiếm/)).toBeVisible();
  await chat.getByRole("button", { name: "Cuộc trò chuyện mới" }).click();
  await expect(chat.getByText(/Mình đã chuẩn bị tìm kiếm/)).toHaveCount(0);
  await expect(chat.getByText(/Chào bạn! Mình là BLUE/)).toBeVisible();
  await chat.getByRole("button", { name: "Đóng khung chat" }).click();
  await page.goto("/login");
  await expect(launcher).toHaveCount(0);
});
