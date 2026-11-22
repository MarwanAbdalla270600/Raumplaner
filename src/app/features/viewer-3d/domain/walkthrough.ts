import {
  addVec,
  closestPointOnSegment,
  distanceBetween,
  normalize,
  pointInPolygon,
  Polygon,
  subVec,
  Vec2,
  vec,
} from '../../../core/domain/geometry';
import { Floor, Room } from '../../project/domain/model';
import { roomArea, roomCenter, roomContainsPoint } from '../../project/domain/room-geometry';
import { SceneDescription } from './scene-description';

/** First-person walkthrough through the apartment (plan coordinates in cm, yaw in radians). */
export interface TourPose {
  readonly position: Vec2;
  /** Viewing direction in the plan: 0 = +x, π/2 = +y (down on the plan). */
  readonly yaw: number;
}

/** Continuous input in [-1, 1] per axis (buttons, keys). */
export interface TourInput {
  readonly forward: number;
  readonly turn: number;
  readonly strafe: number;
}

export const NO_TOUR_INPUT: TourInput = { forward: 0, turn: 0, strafe: 0 };

export const EYE_HEIGHT_CM = 160;
export const WALK_SPEED_CM_PER_S = 140;
export const TURN_SPEED_RAD_PER_S = 1.6;
/** Radius of the walker (keeps the camera out of the walls). */
export const WALKER_RADIUS_CM = 22;
/** Wall pieces starting below this height block walking (sills block, door lintels don't). */
const BLOCKING_MAX_ELEVATION_CM = 40;
const MAX_SUB_STEP_CM = 8;
const RAY_STEP_CM = 10;
const RAY_MAX_CM = 2000;
const VIEW_DIRECTIONS = 16;
const RESOLVE_ITERATIONS = 3;

/** Wall footprints the walker cannot pass (door openings stay free). */
export function tourObstacles(scene: SceneDescription): Polygon[] {
  return scene.walls
    .filter((wall) => wall.kind === 'wall' && wall.elevation < BLOCKING_MAX_ELEVATION_CM)
    .map((wall) => wall.footprint);
}

/** Pushes a circle out of a convex polygon. */
function resolveAgainst(position: Vec2, polygon: Polygon, radius: number): Vec2 {
  let closest: Vec2 | null = null;
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const point = closestPointOnSegment(position, polygon[i], polygon[(i + 1) % polygon.length]).point;
    const distance = distanceBetween(point, position);
    if (distance < best) {
      best = distance;
      closest = point;
    }
  }
  if (!closest) {
    return position;
  }
  if (pointInPolygon(position, polygon)) {
    const out = normalize(subVec(closest, position));
    return addVec(closest, out, radius);
  }
  if (best < radius && best > 0) {
    return addVec(closest, normalize(subVec(position, closest)), radius);
  }
  return position;
}

/** Moves the walker by `delta`, sliding along walls instead of passing through them. */
export function moveWithCollision(
  position: Vec2,
  delta: Vec2,
  obstacles: readonly Polygon[],
  radius = WALKER_RADIUS_CM,
): Vec2 {
  const distance = Math.hypot(delta.x, delta.y);
  const steps = Math.max(1, Math.ceil(distance / MAX_SUB_STEP_CM));
  let current = position;
  for (let s = 0; s < steps; s++) {
    current = addVec(current, delta, 1 / steps);
    for (let i = 0; i < RESOLVE_ITERATIONS; i++) {
      for (const polygon of obstacles) current = resolveAgainst(current, polygon, radius);
    }
  }
  return current;
}

export function stepTour(pose: TourPose, input: TourInput, dt: number, obstacles: readonly Polygon[]): TourPose {
  const yaw = pose.yaw + input.turn * TURN_SPEED_RAD_PER_S * dt;
  const forward = vec(Math.cos(yaw), Math.sin(yaw));
  const right = vec(-forward.y, forward.x);
  const step = WALK_SPEED_CM_PER_S * dt;
  const delta = addVec(
    vec(forward.x * input.forward * step, forward.y * input.forward * step),
    right,
    input.strafe * step,
  );
  const moved = delta.x === 0 && delta.y === 0 ? pose.position : moveWithCollision(pose.position, delta, obstacles);
  return { position: moved, yaw };
}

/** Distance from `origin` in direction `yaw` until the ray leaves the room. */
function freeDistance(room: Room, origin: Vec2, yaw: number): number {
  const direction = vec(Math.cos(yaw), Math.sin(yaw));
  let distance = 0;
  while (distance < RAY_MAX_CM && roomContainsPoint(room, addVec(origin, direction, distance + RAY_STEP_CM))) {
    distance += RAY_STEP_CM;
  }
  return distance;
}

/** Start pose inside a room, looking in the direction with the widest view. */
export function tourStartInRoom(room: Room): TourPose {
  const position = roomCenter(room);
  let best = { yaw: 0, distance: -1 };
  for (let i = 0; i < VIEW_DIRECTIONS; i++) {
    const yaw = (i / VIEW_DIRECTIONS) * Math.PI * 2;
    // Step back a little so that more of the room is visible.
    const distance = freeDistance(room, position, yaw) + freeDistance(room, position, yaw + Math.PI) * 0.5;
    if (distance > best.distance) best = { yaw, distance };
  }
  const back = Math.min(freeDistance(room, position, best.yaw + Math.PI) - WALKER_RADIUS_CM * 2, 150);
  const start =
    back > 0 ? addVec(position, vec(Math.cos(best.yaw + Math.PI), Math.sin(best.yaw + Math.PI)), back) : position;
  return { position: start, yaw: best.yaw };
}

/** Start pose for a floor: the preferred room, otherwise the largest room. */
export function tourStart(floor: Floor, preferred: Room | null): TourPose | null {
  const room = preferred ?? [...floor.rooms].sort((a, b) => roomArea(b) - roomArea(a))[0];
  return room ? tourStartInRoom(room) : null;
}

/** Room the walker is currently in (for the room picker). */
export function roomAt(floor: Floor, position: Vec2): Room | null {
  return floor.rooms.find((room) => roomContainsPoint(room, position)) ?? null;
}
