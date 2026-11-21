import { expect, Page } from '@playwright/test';

export async function createProject(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('new-project').click();
  await page.getByTestId('confirm-dialog').click();
  await page.waitForURL(/\/project\//);
  await expect(page.getByTestId('floor-plan')).toBeVisible();
}

export async function addFromCatalog(page: Page, id: string): Promise<void> {
  const sheet = page.locator('ds-bottom-sheet');
  if (await sheet.count()) {
    if (!(await sheet.evaluate((el) => el.classList.contains('expanded')))) {
      await sheet.locator('.handle').click();
    }
    await page.getByRole('tab', { name: /Katalog|Catalog/ }).click();
  }
  await page.getByTestId(`catalog-${id}`).click();
}

export function furnitureItems(page: Page) {
  return page.locator('[data-item-id]');
}

export async function propertyValue(page: Page, testId: string): Promise<number> {
  // Number fields use the locale's decimal separator (comma in German).
  return Number((await page.getByTestId(testId).locator('input').inputValue()).replace(',', '.'));
}
