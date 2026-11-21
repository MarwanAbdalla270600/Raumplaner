import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const ITEM_COUNT = 120;
const COLUMNS = 12;
const SPACING_CM = 60;

function buildProject() {
  const furniture = Array.from({ length: ITEM_COUNT }, (_, index) => ({
    id: `item_${index}`,
    catalogId: 'chair',
    name: `Stuhl ${index + 1}`,
    category: 'seating',
    x: 40 + (index % COLUMNS) * SPACING_CM,
    y: 40 + Math.floor(index / COLUMNS) * SPACING_CM,
    width: 45,
    depth: 50,
    height: 90,
    rotation: 0,
    elevation: 0,
    layer: index + 1,
    color: '#8b6a4b',
    material: null,
    weight: null,
  }));
  const project = {
    id: 'project_perf',
    name: 'Performance',
    schemaVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    settings: { unit: 'cm', gridSize: 10, snapEnabled: true, showDimensions: true },
    floors: [
      {
        id: 'floor_perf',
        name: 'EG',
        level: 0,
        rooms: [
          {
            id: 'room_perf',
            name: 'Saal',
            x: 0,
            y: 0,
            width: 760,
            depth: 640,
            height: 300,
            wallThickness: 12,
            floorColor: '#d9c4a5',
            wallColor: '#f2efe9',
            openings: [],
          },
        ],
        furniture,
      },
    ],
    customCatalog: [],
  };
  return { format: 'raumplaner.project', schemaVersion: 1, exportedAt: '2026-01-01T00:00:00.000Z', project };
}

test('keeps dragging smooth with more than 100 items', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'desktop measurement');
  const file = testInfo.outputPath('perf.json');
  writeFileSync(file, JSON.stringify(buildProject()));
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.waitForURL(/\/project\//);
  await expect(page.locator('[data-item-id]')).toHaveCount(ITEM_COUNT);

  const item = page.locator('[data-item-id]').nth(50);
  const box = await item.boundingBox();
  if (!box) throw new Error('missing item');
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__frames = [];
    w.__stop = false;
    const loop = (time: number): void => {
      w.__frames.push(time);
      if (!w.__stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (let step = 1; step <= 90; step++) {
    await page.mouse.move(start.x + step * 3, start.y + Math.sin(step / 8) * 40);
  }
  await page.mouse.up();

  const frames = await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __stop: boolean };
    w.__stop = true;
    return w.__frames;
  });
  const deltas = frames.slice(1).map((time, index) => time - frames[index]);
  const sorted = [...deltas].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const average = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;
  testInfo.annotations.push({
    type: 'frame-times',
    description: `avg ${average.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`,
  });
  console.log(`frames: ${deltas.length}, avg ${average.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms`);

  // 60 fps ≈ 16.7 ms per frame. Allow head-room for CI machines.
  expect(average).toBeLessThan(20);
  expect(p95).toBeLessThan(34);
});
