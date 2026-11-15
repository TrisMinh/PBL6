/* global URL, console, document, innerWidth */
import process from "node:process";
import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
const operatorUrl = process.env.OPERATOR_URL ?? "http://127.0.0.1:5374";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const out = new URL(
  "../../../../../docs/implementation/fe-operator-completion/",
  import.meta.url,
);
await mkdir(out, { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${operatorUrl}/login`);
  await page.getByRole("button", { name: "Điền tài khoản demo" }).click();
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Lịch chuyến", exact: true, level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Tổ chức & thành viên", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tổ chức & thành viên", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: new URL("organization-1440.png", out).pathname.replace(
      /^\/([A-Za-z]:)/,
      "$1",
    ),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Đối soát", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đối soát nhà xe", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Chuyến đi", exact: true }).click();
  await page.getByRole("button", { name: "Tạo chuyến mới" }).click();
  await expect(page).toHaveURL(/\/operator\/trips\/new$/);
  await expect(page.getByLabel("Điểm đi", { exact: true })).toBeVisible();
  await page
    .getByLabel("Điểm đi", { exact: true })
    .selectOption({ label: "TP.HCM" });
  await page.getByLabel("Điểm đến", { exact: true }).selectOption("RT-HCM-DLI");
  for (const [label, value] of [
    ["Khởi hành (giờ Việt Nam) - Ngày", "2026-12-20"],
    ["Khởi hành (giờ Việt Nam) - Giờ", "08"],
    ["Khởi hành (giờ Việt Nam) - Phút", "00"],
    ["Đến nơi (giờ Việt Nam) - Ngày", "2026-12-20"],
    ["Đến nơi (giờ Việt Nam) - Giờ", "15"],
    ["Đến nơi (giờ Việt Nam) - Phút", "00"],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole("combobox", { name: "Xe", exact: true }).click();
  await page.getByRole("listbox").getByRole("option").first().click();
  await page.getByRole("combobox", { name: "Tài xế", exact: true }).click();
  await page.getByRole("listbox").getByRole("option").first().click();
  await page.getByLabel("Giá vé (VND)", { exact: true }).fill("450000");
  await page.getByRole("button", { name: "Kiểm tra chuyến" }).click();
  await expect(
    page.getByRole("heading", { name: "Kiểm tra & phát hành chuyến" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Phát hành chuyến", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Lịch chuyến", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.screenshot({
    path: new URL("published-1440.png", out).pathname.replace(
      /^\/([A-Za-z]:)/,
      "$1",
    ),
    fullPage: true,
  });
  await page.goto(`${operatorUrl}/operator/organization`);
  await expect(
    page.getByRole("heading", { name: "Tổ chức & thành viên", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await writeFile(
    new URL("results.json", out),
    JSON.stringify(
      {
        status: "passed",
        checks: [
          "login",
          "organization",
          "settlements",
          "create-review-publish",
          "desktop-reload",
          "no-overflow",
          "logout",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
  console.log(
    "Operator mock UI: login, navigation, create/review/publish, desktop reload and logout passed",
  );
} finally {
  await browser.close();
}
