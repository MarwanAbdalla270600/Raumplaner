import {
  closestPointOnSegment,
  ensureClockwise,
  isSimplePolygon,
  miterOffset,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  polygonLabelPoint,
  polygonSignedArea,
  vec,
} from './geometry';

const square = [vec(0, 0), vec(100, 0), vec(100, 100), vec(0, 100)];
const lShape = [vec(0, 0), vec(50, 0), vec(50, 50), vec(100, 50), vec(100, 100), vec(0, 100)];

describe('polygons', () => {
  it('computes signed areas (positive = clockwise on screen)', () => {
    expect(polygonSignedArea(square)).toBe(10_000);
    expect(polygonSignedArea([...square].reverse())).toBe(-10_000);
    expect(ensureClockwise([...square].reverse())).toEqual([...square].reverse().reverse());
    expect(polygonArea(lShape)).toBe(7_500);
  });

  it('tests points in concave polygons', () => {
    expect(pointInPolygon(vec(25, 75), lShape)).toBe(true);
    expect(pointInPolygon(vec(75, 25), lShape)).toBe(false);
  });

  it('finds a label point inside concave polygons', () => {
    const c = [
      vec(0, 0),
      vec(100, 0),
      vec(100, 20),
      vec(20, 20),
      vec(20, 80),
      vec(100, 80),
      vec(100, 100),
      vec(0, 100),
    ];
    expect(pointInPolygon(polygonCentroid(c), c)).toBe(false);
    expect(pointInPolygon(polygonLabelPoint(c), c)).toBe(true);
  });

  it('detects self-intersections', () => {
    expect(isSimplePolygon(lShape)).toBe(true);
    expect(isSimplePolygon([vec(0, 0), vec(100, 100), vec(100, 0), vec(0, 100)])).toBe(false);
  });

  it('miters corners and projects onto segments', () => {
    const corner = miterOffset(vec(0, 0), vec(0, -1), vec(-1, 0), 10);
    expect(corner.x).toBeCloseTo(-10);
    expect(corner.y).toBeCloseTo(-10);
    expect(closestPointOnSegment(vec(50, 30), vec(0, 0), vec(100, 0))).toEqual({ point: vec(50, 0), t: 0.5 });
  });
});
