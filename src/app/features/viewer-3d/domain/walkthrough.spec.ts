import { pointInPolygon, vec } from '../../../core/domain/geometry';
import { floor, room } from '../../../testing/fixtures';
import { describeScene } from './scene-description';
import { moveWithCollision, roomAt, stepTour, tourObstacles, tourStart, WALKER_RADIUS_CM } from './walkthrough';

describe('walkthrough', () => {
  const r = room({
    x: 0,
    y: 0,
    width: 400,
    depth: 300,
    wallThickness: 12,
    openings: [{ id: 'd', kind: 'door', wall: 1, offset: 100, width: 100, height: 205, sillHeight: 0 }],
  });
  const f = floor({ rooms: [r] });
  const obstacles = tourObstacles(describeScene(f));

  it('starts inside the largest room', () => {
    const pose = tourStart(f, null);
    expect(pose && pointInPolygon(pose.position, r.points)).toBe(true);
  });

  it('does not walk through walls but slides along them', () => {
    const end = moveWithCollision(vec(200, 50), vec(0, -300), obstacles);
    expect(end.y).toBeCloseTo(WALKER_RADIUS_CM, 0);
    const slide = moveWithCollision(vec(200, 30), vec(100, -100), obstacles);
    expect(slide.x).toBeGreaterThan(280);
  });

  it('walks through door openings', () => {
    // The door in the east wall spans y = 100..200.
    const end = moveWithCollision(vec(350, 150), vec(200, 0), obstacles);
    expect(end.x).toBeGreaterThan(500);
  });

  it('turns and moves forward along the viewing direction', () => {
    const pose = stepTour({ position: vec(100, 150), yaw: 0 }, { forward: 1, turn: 0, strafe: 0 }, 0.5, obstacles);
    expect(pose.position.x).toBeCloseTo(170);
    const turned = stepTour(pose, { forward: 0, turn: 1, strafe: 0 }, 0.5, obstacles);
    expect(turned.yaw).toBeCloseTo(0.8);
    expect(roomAt(f, turned.position)?.id).toBe(r.id);
  });
});
