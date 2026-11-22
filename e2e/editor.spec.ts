import { expect, test } from '@playwright/test';
import { addFromCatalog, createProject, furnitureItems, propertyValue } from './helpers';

test.describe('editor (desktop)', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop interactions');

  test.beforeEach(async ({ page }) => {
    await createProject(page);
  });

  test('places furniture from the catalog and shows its properties', async ({ page }) => {
    await addFromCatalog(page, 'sofa-3');
    await expect(furnitureItems(page)).toHaveCount(1);
    await expect(page.getByTestId('prop-width').locator('input')).toHaveValue('220');
  });

  test('drags furniture with the mouse and undoes the move', async ({ page }) => {
    await addFromCatalog(page, 'armchair');
    const startX = await propertyValue(page, 'prop-x');
    const box = await furnitureItems(page).first().boundingBox();
    if (!box) throw new Error('no furniture box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 40, cy, { steps: 5 });
    await page.mouse.move(cx + 80, cy, { steps: 5 });
    await page.mouse.up();

    const movedX = await propertyValue(page, 'prop-x');
    expect(movedX).toBeGreaterThan(startX);

    await page.keyboard.press('Control+z');
    await expect.poll(() => propertyValue(page, 'prop-x')).toBe(startX);
    await page.keyboard.press('Control+y');
    await expect.poll(() => propertyValue(page, 'prop-x')).toBe(movedX);
  });

  test('supports keyboard shortcuts for duplicate, rotate and delete', async ({ page }) => {
    await addFromCatalog(page, 'chair');
    await page.getByTestId('floor-plan').focus();

    await page.keyboard.press('Control+d');
    await expect(furnitureItems(page)).toHaveCount(2);

    await page.keyboard.press('r');
    await expect(furnitureItems(page).nth(1)).toHaveAttribute('transform', /rotate\(90\)/);

    await page.keyboard.press('Delete');
    await expect(furnitureItems(page)).toHaveCount(1);
    await page.keyboard.press('Control+z');
    await expect(furnitureItems(page)).toHaveCount(2);
  });

  test('warns about collisions', async ({ page }) => {
    await addFromCatalog(page, 'dining-table');
    await addFromCatalog(page, 'dining-table');
    await expect(page.getByTestId('collision-count')).toHaveCount(0);

    const firstX = await page.locator('[data-item-id]').first().getAttribute('transform');
    const x = Number(/translate\(([-\d.]+)/.exec(firstX ?? '')?.[1]);
    const y = Number(/translate\([-\d.]+ ([-\d.]+)/.exec(firstX ?? '')?.[1]);
    const xField = page.getByTestId('prop-x').locator('input');
    await xField.fill(String(x));
    await xField.press('Enter');
    const yField = page.locator('ds-number-field').filter({ hasText: 'Y' }).first().locator('input');
    await yField.fill(String(y));
    await yField.press('Enter');

    await expect(page.getByTestId('collision-count')).toBeVisible();
  });

  test('selects several items with a marquee', async ({ page }) => {
    await addFromCatalog(page, 'chair');
    await addFromCatalog(page, 'chair');
    await addFromCatalog(page, 'chair');
    const boxes = await Promise.all((await furnitureItems(page).all()).map((item) => item.boundingBox()));
    const valid = boxes.filter((b): b is NonNullable<typeof b> => b !== null);
    const minX = Math.min(...valid.map((b) => b.x)) - 30;
    const minY = Math.min(...valid.map((b) => b.y)) - 30;
    const maxX = Math.max(...valid.map((b) => b.x + b.width)) + 30;
    const maxY = Math.max(...valid.map((b) => b.y + b.height)) + 30;

    await page.keyboard.press('Escape');
    await page.keyboard.down('Shift');
    await page.mouse.move(minX, minY);
    await page.mouse.down();
    await page.mouse.move(maxX, maxY, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect(page.locator('[data-item-id].selected')).toHaveCount(3);
  });

  test('pans the view by dragging empty space', async ({ page }) => {
    const plan = await page.getByTestId('floor-plan').boundingBox();
    if (!plan) throw new Error('no plan');
    const label = page.locator('.room-label').first();
    const before = await label.boundingBox();
    await page.mouse.move(plan.x + 30, plan.y + 30);
    await page.mouse.down();
    await page.mouse.move(plan.x + 130, plan.y + 90, { steps: 6 });
    await page.mouse.up();
    const after = await label.boundingBox();
    expect(Math.round((after?.x ?? 0) - (before?.x ?? 0))).toBe(100);
    expect(Math.round((after?.y ?? 0) - (before?.y ?? 0))).toBe(60);
  });

  test('adds a room via the form and a door via the properties panel', async ({ page }) => {
    await page.getByTestId('add-room').click();
    await page.getByTestId('room-name').locator('input').fill('Küche');
    const width = page.getByTestId('room-form-width').locator('input');
    await width.fill('320');
    await width.press('Tab');
    await page.getByTestId('confirm-room').click();

    await expect(page.locator('.room-label', { hasText: 'Küche' })).toBeVisible();
    await expect(page.getByTestId('room-width').locator('input')).toHaveValue('320');
    await page.getByTestId('add-door').click();
    await expect(page.locator('.opening-symbol')).toHaveCount(1);
  });

  test('draws a room directly on the floor plan and moves it', async ({ page }) => {
    await page.getByRole('button', { name: /Raum zeichnen|Draw room/ }).click();
    const plan = await page.getByTestId('floor-plan').boundingBox();
    if (!plan) throw new Error('no plan');
    const start = { x: plan.x + plan.width - 260, y: plan.y + 40 };
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 200, start.y + 150, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.room-label')).toHaveCount(2);

    // The new room is selected – dragging its floor moves it as one undo step.
    const roomX = page.getByTestId('room-width');
    await expect(roomX).toBeVisible();
    await page.mouse.move(start.x + 100, start.y + 75);
    await page.mouse.down();
    await page.mouse.move(start.x + 60, start.y + 120, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    await expect(page.locator('.room-label')).toHaveCount(1);
  });

  test('draws a polygonal room corner by corner', async ({ page }) => {
    await page.getByRole('button', { name: /Raum zeichnen|Draw room/ }).click();
    const plan = await page.getByTestId('floor-plan').boundingBox();
    if (!plan) throw new Error('no plan');
    const x0 = plan.x + plan.width - 320;
    const y0 = plan.y + 60;
    const corners = [
      [0, 0],
      [200, 0],
      [200, 100],
      [120, 180],
      [0, 180],
    ];
    for (const [dx, dy] of corners) {
      await page.mouse.click(x0 + dx, y0 + dy);
    }
    await page.keyboard.press('Enter');
    await expect(page.locator('.room-label')).toHaveCount(2);
    await expect(page.locator('[data-handle=vertex]')).toHaveCount(5);
  });

  test('reshapes a room by dragging a wall midpoint', async ({ page }) => {
    await page.locator('.room-floor').first().click();
    const midpoint = page.locator('[data-handle=midpoint]').first();
    const box = await midpoint.boundingBox();
    if (!box) throw new Error('no handle');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 40, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('[data-handle=vertex]')).toHaveCount(5);
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-handle=vertex]')).toHaveCount(4);
  });

  test('attaches a neighbouring room with a shared wall and door', async ({ page }) => {
    await page.locator('.room-floor').first().click();
    await page.getByTestId('walls-disclosure').locator('summary').click();
    await page.getByTestId('attach-room-1').click();
    await expect(page.locator('.room-label')).toHaveCount(2);
    await expect(page.locator('.opening-symbol')).toHaveCount(1);
  });

  test('walks through the apartment in the 3D walkthrough', async ({ page }) => {
    await addFromCatalog(page, 'bed-double');
    await page.getByTestId('open-3d').click();
    const viewer = page.getByTestId('viewer-3d');
    await viewer.getByTestId('start-tour').click();
    await expect(viewer.getByTestId('tour-pad')).toBeVisible();
    const forward = viewer.getByTestId('tour-fwd');
    const box = await forward.boundingBox();
    if (!box) throw new Error('no button');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(forward).toHaveClass(/active/);
    await page.mouse.up();
    await expect(forward).not.toHaveClass(/active/);
    await page.keyboard.down('ArrowLeft');
    await page.keyboard.up('ArrowLeft');
    // Escape leaves the walkthrough first, then closes the viewer.
    await page.keyboard.press('Escape');
    await expect(viewer.getByTestId('tour-pad')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
  });

  test('persists changes across reloads', async ({ page }) => {
    await addFromCatalog(page, 'bed-double');
    await expect(page.getByText(/Gespeichert|Saved/)).toBeVisible();
    await page.reload();
    await expect(furnitureItems(page)).toHaveCount(1);
  });

  test('opens and closes the lazy-loaded 3D view', async ({ page }) => {
    await addFromCatalog(page, 'sofa-3');
    await page.getByTestId('open-3d').click();
    const viewer = page.getByTestId('viewer-3d');
    await expect(viewer).toBeVisible();
    await expect(viewer.locator('canvas')).toBeVisible();
    await viewer.getByRole('button', { name: /Draufsicht|Top view/ }).click();
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
  });

  test('exports and re-imports a project as JSON', async ({ page }, testInfo) => {
    await addFromCatalog(page, 'desk');
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export').click();
    const download = await downloadPromise;
    const file = testInfo.outputPath('project.json');
    await download.saveAs(file);

    await page.goto('/');
    await page.locator('input[type=file]').setInputFiles(file);
    await page.waitForURL(/\/project\//);
    await expect(furnitureItems(page)).toHaveCount(1);
  });
});

test.describe('editor (mobile)', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile layout');

  test('uses a bottom sheet for catalog and properties', async ({ page }) => {
    await createProject(page);
    await expect(page.locator('ds-bottom-sheet')).toBeVisible();
    await addFromCatalog(page, 'sofa-3');
    await expect(furnitureItems(page)).toHaveCount(1);
  });

  test('collapses secondary toolbar actions', async ({ page }) => {
    await createProject(page);
    await expect(page.getByTestId('export')).toHaveCount(0);
    await page.getByRole('button', { name: /Werkzeugleiste|toolbar/i }).click();
    await expect(page.getByTestId('export')).toBeVisible();
  });
});
