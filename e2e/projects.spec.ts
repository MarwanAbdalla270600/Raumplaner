import { expect, test } from '@playwright/test';

test('manages projects: create, rename and delete', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-project').click();
  await page.getByTestId('confirm-dialog').click();
  await page.waitForURL(/\/project\//);
  await page.goto('/');

  const card = page.locator('ds-card').first();
  await card.getByRole('button', { name: /Umbenennen|Rename/ }).click();
  const input = page.locator('dialog[open] input');
  await input.fill('Ferienwohnung');
  await page.getByTestId('confirm-dialog').click();
  await expect(page.getByRole('link', { name: 'Ferienwohnung' })).toBeVisible();

  await page.getByRole('button', { name: /Löschen: Ferienwohnung|Delete: Ferienwohnung/ }).click();
  await page
    .locator('dialog[open]')
    .getByRole('button', { name: /Löschen|Delete/ })
    .click();
  await expect(page.getByRole('link', { name: 'Ferienwohnung' })).toHaveCount(0);
});
