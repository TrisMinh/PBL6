// Support native short filters and searchable long filters in headless checks.
export async function chooseAdminFilter(page, label, value) {
  const control = page.getByRole("combobox", { name: label, exact: true });
  if (await control.evaluate((element) => element.tagName === "SELECT")) {
    await control.selectOption(value);
  } else {
    await control.click();
    await page
      .getByRole("listbox", { name: label, exact: true })
      .locator(`[role="option"][data-value=${JSON.stringify(value)}]`)
      .click();
  }
}
