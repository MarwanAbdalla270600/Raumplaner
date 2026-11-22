import { mixColors, shadeColor } from '../../../core/domain/color';
import { FurnitureItem } from '../../project/domain/model';

/**
 * Procedural, framework-free furniture models. A model is a list of simple parts in the item's
 * local coordinate system (cm): x across the width, y up from the bottom, z along the depth with
 * +z being the front (the side marked with the thick line in the 2D plan).
 */
export type PartShape = 'box' | 'rounded' | 'cylinder' | 'sphere';

export type Finish = 'matte' | 'wood' | 'fabric' | 'metal' | 'gloss' | 'glass' | 'ceramic' | 'emissive' | 'plant';

export interface ModelPart {
  readonly shape: PartShape;
  /** Centre of the part. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Size along x, y, z (cylinders: diameter × height × diameter; spheres: diameters). */
  readonly w: number;
  readonly h: number;
  readonly d: number;
  readonly color: string;
  readonly finish: Finish;
  /** Corner radius of rounded boxes. */
  readonly radius?: number;
  /** Top radius relative to the bottom radius (cylinders only, e.g. lamp shades). */
  readonly taper?: number;
  /** Rotation around the x / y axis in radians (applied before translation). */
  readonly rotateX?: number;
  readonly rotateY?: number;
}

export type ModelKind =
  | 'bed'
  | 'wardrobe'
  | 'shelf'
  | 'cabinet'
  | 'nightstand'
  | 'table'
  | 'round-table'
  | 'coffee-table'
  | 'desk'
  | 'chair'
  | 'armchair'
  | 'sofa'
  | 'corner-sofa'
  | 'office-chair'
  | 'kitchen'
  | 'island'
  | 'fridge'
  | 'bathtub'
  | 'shower'
  | 'sink'
  | 'toilet'
  | 'plant'
  | 'rug'
  | 'lamp'
  | 'tv'
  | 'generic';

const CATALOG_MODELS: Readonly<Record<string, ModelKind>> = {
  'sofa-3': 'sofa',
  'sofa-corner': 'corner-sofa',
  armchair: 'armchair',
  chair: 'chair',
  'bed-double': 'bed',
  'bed-single': 'bed',
  nightstand: 'nightstand',
  wardrobe: 'wardrobe',
  shelf: 'shelf',
  sideboard: 'cabinet',
  'tv-bench': 'cabinet',
  'dining-table': 'table',
  'coffee-table': 'coffee-table',
  'round-table': 'round-table',
  desk: 'desk',
  'office-chair': 'office-chair',
  'kitchen-row': 'kitchen',
  fridge: 'fridge',
  'kitchen-island': 'island',
  bathtub: 'bathtub',
  shower: 'shower',
  sink: 'sink',
  toilet: 'toilet',
  plant: 'plant',
  rug: 'rug',
  'floor-lamp': 'lamp',
  tv: 'tv',
};

/** Keywords (German and English) for custom furniture without catalog id. */
const NAME_KEYWORDS: readonly (readonly [RegExp, ModelKind])[] = [
  [/ecksofa|corner sofa/, 'corner-sofa'],
  [/sofa|couch/, 'sofa'],
  [/sessel|armchair/, 'armchair'],
  [/bürostuhl|office chair/, 'office-chair'],
  [/stuhl|chair|hocker|stool/, 'chair'],
  [/bett|bed/, 'bed'],
  [/nachttisch|nightstand/, 'nightstand'],
  [/schrank|wardrobe|closet/, 'wardrobe'],
  [/regal|shelf|bookcase/, 'shelf'],
  [/kommode|sideboard|lowboard|dresser/, 'cabinet'],
  [/schreibtisch|desk/, 'desk'],
  [/couchtisch|coffee table/, 'coffee-table'],
  [/tisch|table/, 'table'],
  [/kühlschrank|fridge/, 'fridge'],
  [/küche|kitchen/, 'kitchen'],
  [/badewanne|bathtub|wanne/, 'bathtub'],
  [/dusche|shower/, 'shower'],
  [/waschbecken|sink/, 'sink'],
  [/wc|toilet/, 'toilet'],
  [/pflanze|plant|baum|tree/, 'plant'],
  [/teppich|rug|carpet/, 'rug'],
  [/lampe|lamp|leuchte/, 'lamp'],
  [/fernseher|tv|monitor/, 'tv'],
];

const CATEGORY_FALLBACK: Readonly<Record<FurnitureItem['category'], (item: FurnitureItem) => ModelKind>> = {
  seating: (item) => (item.width >= 120 ? 'sofa' : item.width < 70 ? 'chair' : 'armchair'),
  bed: () => 'bed',
  storage: (item) => (item.height > 120 ? 'wardrobe' : 'cabinet'),
  table: () => 'table',
  kitchen: (item) => (item.height > 120 ? 'fridge' : 'kitchen'),
  bathroom: () => 'generic',
  office: (item) => (item.height < 100 ? 'desk' : 'generic'),
  decor: () => 'generic',
  other: () => 'generic',
};

export function modelKindFor(item: FurnitureItem): ModelKind {
  const byCatalog = item.catalogId ? CATALOG_MODELS[item.catalogId] : undefined;
  if (byCatalog) {
    return byCatalog;
  }
  const name = item.name.toLowerCase();
  const byName = NAME_KEYWORDS.find(([pattern]) => pattern.test(name));
  return byName ? byName[1] : CATEGORY_FALLBACK[item.category](item);
}

// ── Builder ──────────────────────────────────────────────────────────────

const WHITE = '#f7f5f0';
const LINEN = '#ece6da';
const METAL = '#b8bcc2';
const DARK = '#2b2b2e';
const STEEL = '#8d9299';
const GLASS = '#cfe6f0';
const CERAMIC = '#fbfbfa';

/** Small fluent helper; `box(...)` positions parts by their bottom (y0) instead of their centre. */
class Parts {
  readonly list: ModelPart[] = [];

  box(
    x: number,
    y0: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    finish: Finish,
    extra: Partial<ModelPart> = {},
  ): this {
    if (w > 0 && h > 0 && d > 0) {
      this.list.push({ shape: 'box', x, y: y0 + h / 2, z, w, h, d, color, finish, ...extra });
    }
    return this;
  }

  rounded(
    x: number,
    y0: number,
    z: number,
    w: number,
    h: number,
    d: number,
    radius: number,
    color: string,
    finish: Finish,
    extra: Partial<ModelPart> = {},
  ): this {
    if (w > 0 && h > 0 && d > 0) {
      const r = Math.max(0.1, Math.min(radius, w / 2, h / 2, d / 2) - 0.01);
      this.list.push({ shape: 'rounded', x, y: y0 + h / 2, z, w, h, d, radius: r, color, finish, ...extra });
    }
    return this;
  }

  cylinder(
    x: number,
    y0: number,
    z: number,
    diameter: number,
    h: number,
    color: string,
    finish: Finish,
    extra: Partial<ModelPart> = {},
  ): this {
    if (diameter > 0 && h > 0) {
      this.list.push({ shape: 'cylinder', x, y: y0 + h / 2, z, w: diameter, h, d: diameter, color, finish, ...extra });
    }
    return this;
  }

  sphere(x: number, y: number, z: number, w: number, h: number, d: number, color: string, finish: Finish): this {
    this.list.push({ shape: 'sphere', x, y, z, w, h, d, color, finish });
    return this;
  }

  /** Four legs inset from the corners of a w × d footprint. */
  legs(
    w: number,
    d: number,
    inset: number,
    size: number,
    height: number,
    color: string,
    finish: Finish,
    round = false,
  ): this {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const x = sx * (w / 2 - inset - size / 2);
        const z = sz * (d / 2 - inset - size / 2);
        if (round) this.cylinder(x, 0, z, size, height, color, finish);
        else this.box(x, 0, z, size, height, size, color, finish);
      }
    }
    return this;
  }
}

const clampTo = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

/** Deterministic pseudo random number in [0, 1) for decorative variation (books, leaves). */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// ── Models ───────────────────────────────────────────────────────────────

type Builder = (item: FurnitureItem, p: Parts) => void;

const bed: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const legH = clampTo(H * 0.18, 4, 12);
  const frameTop = clampTo(H * 0.55, legH + 8, H - 8);
  const mattressH = H - frameTop;
  p.legs(W, D, 4, 6, legH, shadeColor(color, -0.25), 'wood');
  p.rounded(0, legH, 0, W, frameTop - legH, D, 2, color, 'wood');
  p.rounded(0, frameTop, 3, W - 6, mattressH, D - 12, 5, WHITE, 'fabric');
  // Headboard at the back.
  p.rounded(0, legH, -D / 2 + 3, W, H + 45 - legH, 6, 2.5, shadeColor(color, -0.08), 'wood');
  // Duvet covering the front two thirds, with a folded edge.
  const duvetDepth = (D - 12) * 0.68;
  const duvetZ = D / 2 - 6 - duvetDepth / 2 + 3;
  p.rounded(0, H - 2, duvetZ, W - 2, 6, duvetDepth, 3, LINEN, 'fabric');
  p.rounded(0, H + 3, duvetZ - duvetDepth / 2 + 8, W - 3, 3, 16, 1.5, shadeColor(LINEN, 0.4), 'fabric');
  p.rounded(0, H - 1, D / 2 - 26, W + 1, 7.5, 30, 2, mixColors(color, '#5f6f86', 0.6), 'fabric');
  // Pillows.
  const count = W >= 140 ? 2 : 1;
  const pillowW = (W - 20) / count - 6;
  for (let i = 0; i < count; i++) {
    const x = -((count - 1) * (pillowW + 6)) / 2 + i * (pillowW + 6);
    p.rounded(x, H - 1, -D / 2 + 30, pillowW, 13, 36, 5.5, '#ffffff', 'fabric', { rotateX: -0.18 });
  }
};

const wardrobe: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const plinth = 8;
  p.box(0, plinth, -1, W, H - plinth, D - 2, color, 'matte');
  p.box(0, 0, -2, W - 4, plinth, D - 6, DARK, 'matte');
  const doors = Math.max(1, Math.round(W / 50));
  const gap = 0.6;
  const doorW = (W - gap * (doors + 1)) / doors;
  const doorColor = shadeColor(color, 0.05);
  for (let i = 0; i < doors; i++) {
    const x = -W / 2 + gap + doorW / 2 + i * (doorW + gap);
    p.box(x, plinth + 0.5, D / 2 - 1, doorW, H - plinth - 1.5, 2, doorColor, 'matte');
    const handleSide = i % 2 === 0 ? 1 : -1;
    const handleX = doors === 1 ? x + doorW / 2 - 5 : x + handleSide * (doorW / 2 - 4);
    p.box(handleX, H * 0.45, D / 2 + 1, 1.2, 28, 1.6, METAL, 'metal');
  }
};

const BOOK_COLORS = ['#7a3b2e', '#2f4b6e', '#c9a227', '#3f6b4a', '#8c8c8c', '#b85c38', '#5a4e7c', '#e5ddd0'];

const shelf: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const t = 2.5;
  p.box(-W / 2 + t / 2, 0, 0, t, H, D, color, 'wood');
  p.box(W / 2 - t / 2, 0, 0, t, H, D, color, 'wood');
  p.box(0, 0, -D / 2 + 0.5, W - 2 * t, H, 1, shadeColor(color, -0.08), 'wood');
  const boards = Math.max(2, Math.round(H / 38));
  const spacing = (H - t) / boards;
  for (let i = 0; i <= boards; i++) {
    p.box(0, i * spacing, 0.5, W - 2 * t, t, D - 1, color, 'wood');
  }
  // Books on the inner boards.
  for (let level = 1; level < boards; level++) {
    let x = -W / 2 + t + 2;
    let n = 0;
    while (x < W / 2 - t - 6 && n < 30) {
      const seed = level * 31 + n;
      const bookW = 2 + pseudoRandom(seed) * 3;
      const bookH = Math.min(spacing - t - 3, 18 + pseudoRandom(seed + 7) * 12);
      if (pseudoRandom(seed + 3) > 0.25) {
        const bookColor = BOOK_COLORS[Math.floor(pseudoRandom(seed + 11) * BOOK_COLORS.length)];
        p.box(x + bookW / 2, level * spacing + t, 1, bookW, bookH, D - 8, bookColor, 'matte');
      }
      x += bookW + 0.3;
      n++;
    }
  }
};

const cabinet: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const legH = H >= 60 ? 12 : 6;
  p.legs(W, D, 4, 3, legH, shadeColor(color, -0.3), 'wood', true);
  p.box(0, legH, 0, W, H - legH, D, color, 'wood');
  const fronts = Math.max(1, Math.round(W / 45));
  const gap = 0.6;
  const frontW = (W - gap * (fronts + 1)) / fronts;
  for (let i = 0; i < fronts; i++) {
    const x = -W / 2 + gap + frontW / 2 + i * (frontW + gap);
    p.box(x, legH + 1.5, D / 2 + 0.5, frontW, H - legH - 3, 1.2, shadeColor(color, 0.06), 'wood');
    p.box(x, H - 8, D / 2 + 1.6, Math.min(14, frontW * 0.4), 1.2, 1.2, METAL, 'metal');
  }
};

const nightstand: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  p.legs(W, D, 2, 3, 10, shadeColor(color, -0.3), 'wood', true);
  p.box(0, 10, 0, W, H - 10, D, color, 'wood');
  p.box(0, H - 16, D / 2 + 0.5, W - 3, 13, 1.2, shadeColor(color, 0.08), 'wood');
  p.sphere(0, H - 9.5, D / 2 + 2, 2.4, 2.4, 2.4, METAL, 'metal');
};

const table: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const top = 4;
  p.rounded(0, H - top, 0, W, top, D, 1, color, 'wood');
  p.legs(W, D, 6, 6, H - top, shadeColor(color, -0.15), 'wood');
};

const coffeeTable: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  p.rounded(0, H - 4, 0, W, 4, D, 1.5, color, 'wood');
  p.legs(W, D, 4, 4, H - 4, shadeColor(color, -0.2), 'wood');
  p.box(0, 10, 0, W - 12, 2, D - 12, shadeColor(color, -0.08), 'wood');
};

const roundTable: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  p.cylinder(0, H - 3, 0, W, 3, color, 'wood', { d: D });
  p.cylinder(0, 2, 0, 7, H - 5, DARK, 'metal');
  p.cylinder(0, 0, 0, Math.min(W, D) * 0.6, 2, DARK, 'metal');
};

const desk: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  p.rounded(0, H - 3, 0, W, 3, D, 0.8, color, 'wood');
  const legColor = DARK;
  p.box(-W / 2 + 4, 0, 0, 4, H - 3, D - 8, legColor, 'metal');
  const unitW = Math.min(42, W * 0.32);
  const unitX = W / 2 - unitW / 2 - 2;
  p.box(unitX, 0, 0, unitW, H - 4, D - 6, shadeColor(color, -0.05), 'wood');
  for (let i = 0; i < 3; i++) {
    const h = (H - 8) / 3;
    p.box(unitX, 2 + i * h, (D - 6) / 2 + 0.5, unitW - 2, h - 1, 1, shadeColor(color, 0.04), 'wood');
    p.box(unitX, 2 + i * h + h - 6, (D - 6) / 2 + 1.5, 10, 1, 1, METAL, 'metal');
  }
  // A laptop for scale.
  p.box(-W * 0.12, H, 4, 32, 1.5, 22, '#4a4d52', 'metal');
  p.box(-W * 0.12, H + 1.5, -6.5, 32, 21, 1, '#4a4d52', 'metal', { rotateX: -0.25 });
};

const chair: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const seatH = clampTo(H * 0.5, 30, 50);
  p.legs(W, D, 2, 3.5, seatH - 3, shadeColor(color, -0.15), 'wood');
  p.rounded(0, seatH - 3, 0, W, 4, D, 1.5, color, 'wood');
  for (const sx of [-1, 1]) {
    p.box(sx * (W / 2 - 3.75), seatH, -D / 2 + 2, 3.5, H - seatH, 3.5, shadeColor(color, -0.15), 'wood', {
      rotateX: -0.08,
    });
  }
  p.rounded(0, H - 18, -D / 2 + 2.5, W - 4, 14, 2.5, 1, color, 'wood', { rotateX: -0.08 });
};

function upholstered(p: Parts, W: number, D: number, H: number, color: string, seats: number, arms = true): void {
  const legH = 8;
  const seatTop = clampTo(H * 0.5, 38, 48);
  const armW = arms ? clampTo(W * 0.1, 12, 22) : 0;
  const backD = clampTo(D * 0.22, 16, 26);
  const fabricDark = shadeColor(color, -0.12);
  p.legs(W, D, 5, 4, legH, '#3b2f25', 'wood', true);
  p.rounded(0, legH, 0, W, seatTop - legH - 12, D, 4, fabricDark, 'fabric');
  // Backrest
  p.rounded(0, legH, -D / 2 + backD / 2, W, H - legH, backD, 6, fabricDark, 'fabric');
  if (arms) {
    for (const sx of [-1, 1]) {
      p.rounded(sx * (W / 2 - armW / 2), legH, 0, armW, seatTop + 18 - legH, D, 6, fabricDark, 'fabric');
    }
  }
  const innerW = W - 2 * armW;
  const cushionW = innerW / seats;
  for (let i = 0; i < seats; i++) {
    const x = -innerW / 2 + cushionW / 2 + i * cushionW;
    p.rounded(x, seatTop - 12, backD / 2 + 1, cushionW - 1, 13, D - backD - 2, 5, color, 'fabric');
    p.rounded(x, seatTop, -D / 2 + backD + 7, cushionW - 3, H - seatTop - 6, 16, 6, color, 'fabric', {
      rotateX: -0.15,
    });
  }
}

const armchair: Builder = ({ width: W, depth: D, height: H, color }, p) => upholstered(p, W, D, H, color, 1);
const sofa: Builder = ({ width: W, depth: D, height: H, color }, p) => upholstered(p, W, D, H, color, W >= 180 ? 3 : 2);

const cornerSofa: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const mainD = clampTo(D * 0.55, 80, 100);
  const chaiseW = clampTo(W * 0.38, 80, 110);
  const legH = 8;
  const seatTop = clampTo(H * 0.5, 38, 48);
  const backD = 22;
  const fabricDark = shadeColor(color, -0.12);
  const mainZ = -D / 2 + mainD / 2;
  // Main part along the back, chaise on the right extending to the front.
  p.rounded(0, legH, mainZ, W, seatTop - legH - 12, mainD, 4, fabricDark, 'fabric');
  p.rounded(
    W / 2 - chaiseW / 2,
    legH,
    (mainD - 0) / 2,
    chaiseW,
    seatTop - legH - 12,
    D - mainD,
    4,
    fabricDark,
    'fabric',
  );
  p.rounded(0, legH, -D / 2 + backD / 2, W, H - legH, backD, 6, fabricDark, 'fabric');
  p.rounded(-W / 2 + 10, legH, mainZ, 20, seatTop + 18 - legH, mainD, 6, fabricDark, 'fabric');
  p.legs(W, D, 5, 4, legH, '#3b2f25', 'wood', true);
  const seatsW = W - 20 - chaiseW;
  const seats = Math.max(1, Math.round(seatsW / 70));
  const cushionW = seatsW / seats;
  for (let i = 0; i < seats; i++) {
    const x = -W / 2 + 20 + cushionW / 2 + i * cushionW;
    p.rounded(x, seatTop - 12, mainZ + backD / 2, cushionW - 1, 13, mainD - backD - 2, 5, color, 'fabric');
    p.rounded(x, seatTop, -D / 2 + backD + 7, cushionW - 3, H - seatTop - 6, 16, 6, color, 'fabric', {
      rotateX: -0.15,
    });
  }
  p.rounded(W / 2 - chaiseW / 2, seatTop - 12, backD / 2, chaiseW - 2, 13, D - backD - 2, 5, color, 'fabric');
  p.rounded(W / 2 - chaiseW / 2, seatTop, -D / 2 + backD + 7, chaiseW - 4, H - seatTop - 6, 16, 6, color, 'fabric', {
    rotateX: -0.15,
  });
};

const officeChair: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const seatH = clampTo(H * 0.45, 40, 52);
  const reach = Math.min(W, D) / 2 - 3;
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    p.box(Math.sin(angle) * reach * 0.5, 5, Math.cos(angle) * reach * 0.5, 4, 3, reach, DARK, 'metal', {
      rotateY: angle,
    });
    p.sphere(Math.sin(angle) * reach, 2.5, Math.cos(angle) * reach, 5, 5, 5, DARK, 'gloss');
  }
  p.cylinder(0, 8, 0, 5, seatH - 14, METAL, 'metal');
  p.rounded(0, seatH - 7, 2, W * 0.78, 8, D * 0.75, 3.5, color, 'fabric');
  p.rounded(0, seatH + 8, -D / 2 + 8, W * 0.7, H - seatH - 8, 6, 3, color, 'fabric', { rotateX: -0.12 });
  p.box(0, seatH - 6, -D / 2 + 9, 4, 16, 3, DARK, 'metal');
  for (const sx of [-1, 1]) {
    p.box(sx * W * 0.4, seatH, 2, 3, 18, 3, DARK, 'metal');
    p.rounded(sx * W * 0.4, seatH + 17, 2, 5, 3, 24, 1.2, DARK, 'gloss');
  }
};

function counter(p: Parts, W: number, D: number, H: number, color: string, withSink: boolean): void {
  const plinth = 10;
  const top = 4;
  p.box(0, 0, -3, W - 2, plinth, D - 8, DARK, 'matte');
  p.box(0, plinth, -1, W, H - top - plinth, D - 2, color, 'matte');
  const fronts = Math.max(1, Math.round(W / 60));
  const frontW = (W - 0.6 * (fronts + 1)) / fronts;
  for (let i = 0; i < fronts; i++) {
    const x = -W / 2 + 0.6 + frontW / 2 + i * (frontW + 0.6);
    p.box(x, plinth + 0.5, D / 2 - 1, frontW, H - top - plinth - 1, 1.8, shadeColor(color, 0.04), 'gloss');
    p.box(x, H - top - 6, D / 2 + 1, Math.min(frontW * 0.6, 30), 1.2, 1.6, STEEL, 'metal');
  }
  p.box(0, H - top, 0, W + 2, top, D + 2, '#cfc8bc', 'ceramic');
  // Hob with four rings.
  const hobX = -W * 0.22;
  p.box(hobX, H, 0, Math.min(58, W * 0.3), 0.6, Math.min(50, D - 8), '#121212', 'gloss');
  for (const [dx, dz] of [
    [-12, -10],
    [12, -10],
    [-12, 10],
    [12, 10],
  ]) {
    p.cylinder(hobX + dx, H + 0.6, dz, 16, 0.2, '#3a3a3a', 'gloss');
  }
  if (withSink) {
    const sinkX = W * 0.24;
    p.box(sinkX, H, 2, Math.min(55, W * 0.25), 0.8, Math.min(44, D - 12), STEEL, 'metal');
    p.box(sinkX, H, 2, Math.min(42, W * 0.2), 0.9, Math.min(34, D - 20), '#6f757c', 'metal');
    p.cylinder(sinkX, H, -D / 2 + 7, 3.5, 30, STEEL, 'metal');
    p.box(sinkX, H + 27, -D / 2 + 13, 2.5, 2.5, 14, STEEL, 'metal');
  }
}

const kitchen: Builder = ({ width: W, depth: D, height: H, color }, p) => counter(p, W, D, H, color, true);
const island: Builder = ({ width: W, depth: D, height: H, color }, p) => counter(p, W, D, H, color, false);

const fridge: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  p.rounded(0, 0, -1.5, W, H, D - 3, 2, color, 'gloss');
  const freezerH = H * 0.35;
  p.rounded(0, 1, D / 2 - 2, W - 1, freezerH - 1.5, 3, 1, shadeColor(color, 0.06), 'gloss');
  p.rounded(0, freezerH + 0.5, D / 2 - 2, W - 1, H - freezerH - 1.5, 3, 1, shadeColor(color, 0.06), 'gloss');
  p.box(W / 2 - 6, freezerH + 8, D / 2 + 0.5, 2, 35, 2.5, STEEL, 'metal');
  p.box(W / 2 - 6, freezerH - 30, D / 2 + 0.5, 2, 22, 2.5, STEEL, 'metal');
};

const bathtub: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const rim = 7;
  p.rounded(0, 0, 0, W, H * 0.35, D, 3, color, 'ceramic');
  p.rounded(0, 0, -D / 2 + rim / 2, W, H, rim, 3, color, 'ceramic');
  p.rounded(0, 0, D / 2 - rim / 2, W, H, rim, 3, color, 'ceramic');
  p.rounded(-W / 2 + rim / 2, 0, 0, rim, H, D, 3, color, 'ceramic');
  p.rounded(W / 2 - rim / 2, 0, 0, rim, H, D, 3, color, 'ceramic');
  p.box(0, H * 0.35, 0, W - 2 * rim, 1, D - 2 * rim, '#d7e8ef', 'gloss');
  p.cylinder(-W / 2 + 3.5, H, 0, 3, 14, STEEL, 'metal');
  p.box(-W / 2 + 8, H + 11, 0, 10, 2.5, 2.5, STEEL, 'metal');
};

const shower: Builder = ({ width: W, depth: D, height: H }, p) => {
  p.rounded(0, 0, 0, W, 6, D, 1.5, CERAMIC, 'ceramic');
  p.box(0, 6, D / 2 - 0.5, W, H - 6, 0.8, GLASS, 'glass');
  p.box(-W / 2 + 0.5, 6, 0, 0.8, H - 6, D, GLASS, 'glass');
  p.box(0, H - 1.5, D / 2 - 0.5, W, 1.5, 1.5, STEEL, 'metal');
  p.box(-W / 2 + 0.5, H - 1.5, 0, 1.5, 1.5, D, STEEL, 'metal');
  p.cylinder(W / 2 - 5, 6, -D / 2 + 4, 2, H - 20, STEEL, 'metal');
  p.cylinder(W / 2 - 15, H - 16, -D / 2 + 14, 20, 1.5, STEEL, 'metal');
};

const sink: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const basinH = 14;
  p.box(0, 10, -1, W - 4, H - basinH - 10, D - 4, '#a88b6a', 'wood');
  p.box(0, 12, D / 2 - 2.5, W - 6, H - basinH - 14, 1.2, '#b89a78', 'wood');
  p.rounded(0, H - basinH, 0, W, basinH, D, 4, color, 'ceramic');
  p.rounded(0, H - 1, 3, W - 12, 1.2, D - 16, 4, '#dfe5ea', 'gloss');
  p.cylinder(0, H, -D / 2 + 6, 3.5, 16, STEEL, 'metal');
  p.box(0, H + 13, -D / 2 + 10, 2.5, 2.5, 9, STEEL, 'metal');
};

const toilet: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const seat = Math.min(42, H * 0.52);
  p.rounded(0, 0, D * 0.06, W * 0.6, seat - 10, D * 0.45, 5, color, 'ceramic');
  p.sphere(0, seat - 8, D * 0.12, W, 18, D * 0.72, color, 'ceramic');
  p.cylinder(0, seat - 1, D * 0.12, W * 0.98, 2.5, color, 'ceramic', { d: D * 0.7 });
  p.rounded(0, seat - 4, -D / 2 + 9, W, H - seat + 4, 18, 4, color, 'ceramic');
  p.rounded(0, H - 0.5, -D / 2 + 9, 8, 1.2, 4, 0.5, STEEL, 'metal');
};

const plant: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const potH = clampTo(H * 0.28, 15, 45);
  const potD = Math.min(W, D) * 0.6;
  p.cylinder(0, 0, 0, potD, potH, '#b5653d', 'ceramic', { taper: 1.18 });
  p.cylinder(0, potH - 1, 0, potD * 1.08, 1.5, '#3b2a1e', 'matte');
  p.cylinder(0, potH, 0, 2.5, (H - potH) * 0.55, '#5b4632', 'wood');
  const leaves = 9;
  for (let i = 0; i < leaves; i++) {
    const angle = (i / leaves) * Math.PI * 2 + pseudoRandom(i) * 0.6;
    const level = pseudoRandom(i + 20);
    const radius = (Math.min(W, D) / 2) * (0.35 + 0.45 * pseudoRandom(i + 40));
    const size = Math.min(W, D) * (0.35 + 0.2 * pseudoRandom(i + 60));
    const y = potH + (H - potH) * (0.35 + 0.5 * level);
    const shade = shadeColor(color, (pseudoRandom(i + 80) - 0.5) * 0.35);
    p.sphere(Math.cos(angle) * radius, y, Math.sin(angle) * radius, size, size * 0.8, size, shade, 'plant');
  }
  p.sphere(
    0,
    H - Math.min(W, D) * 0.25,
    0,
    Math.min(W, D) * 0.55,
    Math.min(W, D) * 0.45,
    Math.min(W, D) * 0.55,
    color,
    'plant',
  );
};

const rug: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  p.box(0, 0, 0, W, H, D, shadeColor(color, -0.18), 'fabric');
  p.box(0, 0, 0, W - 12, H + 0.15, D - 12, color, 'fabric');
  p.box(0, 0, 0, W - 40, H + 0.3, D - 40, shadeColor(color, 0.15), 'fabric');
};

const lamp: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const shadeH = clampTo(H * 0.2, 18, 35);
  p.cylinder(0, 0, 0, Math.min(W, D) * 0.75, 2.5, DARK, 'metal');
  p.cylinder(0, 2.5, 0, 2, H - shadeH - 2, DARK, 'metal');
  p.cylinder(0, H - shadeH, 0, Math.min(W, D), shadeH, color, 'emissive', { taper: 0.7 });
};

const tv: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  const feet = 6;
  p.box(0, feet, 0, W, H - feet, Math.min(D, 5), color, 'gloss');
  p.box(0, feet + 1.2, Math.min(D, 5) / 2 + 0.05, W - 2.4, H - feet - 2.4, 0.2, '#0b1520', 'gloss');
  for (const sx of [-1, 1]) {
    p.box(sx * W * 0.38, 0, 0, 3, feet, Math.max(D, 20), DARK, 'metal');
  }
};

const generic: Builder = ({ width: W, depth: D, height: H, color }, p) => {
  p.rounded(0, 0, 0, W, H, D, Math.min(4, Math.min(W, D, H) * 0.15), color, 'matte');
};

const BUILDERS: Readonly<Record<ModelKind, Builder>> = {
  bed,
  wardrobe,
  shelf,
  cabinet,
  nightstand,
  table,
  'round-table': roundTable,
  'coffee-table': coffeeTable,
  desk,
  chair,
  armchair,
  sofa,
  'corner-sofa': cornerSofa,
  'office-chair': officeChair,
  kitchen,
  island,
  fridge,
  bathtub,
  shower,
  sink,
  toilet,
  plant,
  rug,
  lamp,
  tv,
  generic,
};

/** Parts of the procedural 3D model for a furniture item. */
export function furnitureModel(item: FurnitureItem): ModelPart[] {
  const parts = new Parts();
  BUILDERS[modelKindFor(item)](item, parts);
  return parts.list;
}
