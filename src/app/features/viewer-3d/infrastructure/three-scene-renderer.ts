import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  FrontSide,
  Group,
  HemisphereLight,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { aabbCenter, aabbHeight, aabbWidth, degToRad, Polygon } from '../../../core/domain/geometry';
import { shadeColor } from '../../../core/domain/color';
import { Room } from '../../project/domain/model';
import { cameraPose, CameraPresetId } from '../domain/camera-presets';
import { Finish, ModelPart } from '../domain/furniture-models';
import { SceneDescription, SceneFurniture, ScenePrism, SceneSurface } from '../domain/scene-description';
import { SceneRenderer } from '../domain/scene-renderer';
import { EYE_HEIGHT_CM, NO_TOUR_INPUT, stepTour, TourInput, TourPose } from '../domain/walkthrough';

/** The scene content is modelled in centimetres and scaled to metres for Three.js. */
const CM_TO_M = 0.01;
const FIELD_OF_VIEW = 50;
const TOUR_FIELD_OF_VIEW = 72;
const NEAR_PLANE = 0.05;
const FAR_PLANE = 500;
const SHADOW_MAP_SIZE = 2048;
const GROUND_MARGIN = 20;
const SKY_COLOR = 0xdfe8f2;
const GROUND_COLOR = 0xb9b3a7;
const GROUND_HEX = '#b9b3a7';
const BACKGROUND_COLOR = 0xe9edf2;
const SUN_OFFSET = { x: 0.6, y: 1.4, z: 0.9 } as const;
const MAX_PIXEL_RATIO = 2;
const GLASS_OPACITY = 0.3;
/** Size of one floor texture tile (cm). */
const FLOOR_TILE_CM = 240;
const LOOK_SENSITIVITY = 0.005;
const MAX_PITCH = 1.2;
const MAX_FRAME_SECONDS = 0.05;
const CYLINDER_SEGMENTS = 28;

const FINISHES: Readonly<Record<Finish, MeshStandardMaterialParameters>> = {
  matte: { roughness: 0.85, metalness: 0 },
  wood: { roughness: 0.6, metalness: 0 },
  fabric: { roughness: 1, metalness: 0 },
  metal: { roughness: 0.3, metalness: 0.85 },
  gloss: { roughness: 0.18, metalness: 0.05 },
  glass: { roughness: 0.05, metalness: 0, transparent: true, opacity: GLASS_OPACITY, depthWrite: false },
  ceramic: { roughness: 0.22, metalness: 0 },
  emissive: { roughness: 0.6, metalness: 0, emissiveIntensity: 0.9 },
  plant: { roughness: 0.75, metalness: 0 },
};

/** Planar shape from plan points; `flipY` mirrors y so that a rotation of -90° maps y to +z. */
function planShape(points: Polygon, flipY: boolean): Shape {
  const shape = new Shape();
  points.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, flipY ? -p.y : p.y) : shape.lineTo(p.x, flipY ? -p.y : p.y)));
  shape.closePath();
  return shape;
}

/** Procedural parquet texture tinted with the floor colour. */
function plankTexture(color: string): CanvasTexture | null {
  const canvas = document.createElement('canvas');
  const size = 512;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const rows = 8;
  const rowH = size / rows;
  let seed = 1;
  const random = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let row = 0; row < rows; row++) {
    const plankLength = size / 2;
    const shift = (row % 2) * plankLength * 0.5 + random() * 40;
    for (let x = -plankLength; x < size + plankLength; x += plankLength) {
      ctx.fillStyle = shadeColor(color, (random() - 0.5) * 0.16);
      ctx.fillRect(x + shift, row * rowH, plankLength, rowH);
      ctx.strokeStyle = shadeColor(color, -0.25);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + shift, row * rowH, plankLength, rowH);
    }
    ctx.globalAlpha = 0.12;
    for (let g = 0; g < 6; g++) {
      ctx.strokeStyle = shadeColor(color, -0.4);
      ctx.beginPath();
      const y = row * rowH + random() * rowH;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + random() * 6 - 3, size * 0.6, y + random() * 6 - 3, size, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1 / FLOOR_TILE_CM, 1 / FLOOR_TILE_CM);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

interface TourState {
  pose: TourPose;
  pitch: number;
  input: TourInput;
  obstacles: readonly Polygon[];
  last: number | null;
  dirty: boolean;
  drag: { x: number; y: number; id: number } | null;
}

/** Adapter that turns a framework-free SceneDescription into a Three.js scene. */
export class ThreeSceneRenderer implements SceneRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, NEAR_PLANE, FAR_PLANE);
  /** Holds everything built in centimetres. */
  private readonly content = new Group();
  private readonly sun = new DirectionalLight(0xffffff, 2.2);
  private controls: OrbitControls | null = null;
  private description: SceneDescription | null = null;
  private readonly materials = new Map<string, Material>();
  private readonly textures = new Map<string, Texture>();
  private tour: TourState | null = null;

  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFShadowMap;

    this.scene.background = new Color(BACKGROUND_COLOR);
    this.scene.add(new HemisphereLight(SKY_COLOR, GROUND_COLOR, 1.15));
    this.scene.add(new AmbientLight(0xffffff, 0.4));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.content.scale.setScalar(CM_TO_M);
    this.scene.add(this.sun, this.sun.target, this.content);
  }

  mount(container: HTMLElement): void {
    const canvas = this.renderer.domElement;
    container.appendChild(canvas);
    canvas.setAttribute('aria-hidden', 'true');
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.addEventListener('change', () => this.draw());
    this.controls.screenSpacePanning = true;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerUp);
  }

  render(description: SceneDescription): void {
    this.description = description;
    this.clearContent();
    description.surfaces.forEach((surface) => this.content.add(this.createSurface(surface)));
    this.createWalls(description.walls).forEach((mesh) => this.content.add(mesh));
    description.furniture.forEach((item) => this.content.add(this.createFurniture(item)));
    this.content.add(this.createGround(description));
    this.fitSun(description);
    this.draw();
  }

  applyPreset(preset: CameraPresetId, room: Room | null): void {
    if (!this.description) return;
    this.stopTour();
    const pose = cameraPose(preset, this.description.bounds, room);
    this.camera.position.set(pose.position.x * CM_TO_M, pose.position.y * CM_TO_M, pose.position.z * CM_TO_M);
    this.controls?.target.set(pose.target.x * CM_TO_M, pose.target.y * CM_TO_M, pose.target.z * CM_TO_M);
    this.controls?.update();
    this.draw();
  }

  // ── Walkthrough ─────────────────────────────────────────────────────────

  startTour(pose: TourPose, obstacles: readonly Polygon[]): void {
    this.tour = { pose, pitch: -0.05, input: NO_TOUR_INPUT, obstacles, last: null, dirty: true, drag: null };
    if (this.controls) this.controls.enabled = false;
    this.camera.fov = TOUR_FIELD_OF_VIEW;
    this.camera.updateProjectionMatrix();
    this.renderer.setAnimationLoop((time) => this.tick(time));
  }

  setTourInput(input: TourInput): void {
    if (this.tour) {
      this.tour.input = input;
      this.tour.dirty = true;
    }
  }

  tourPose(): TourPose | null {
    return this.tour?.pose ?? null;
  }

  stopTour(): void {
    if (!this.tour) return;
    this.tour = null;
    this.renderer.setAnimationLoop(null);
    if (this.controls) this.controls.enabled = true;
    this.camera.fov = FIELD_OF_VIEW;
    this.camera.updateProjectionMatrix();
  }

  private tick(time: number): void {
    const tour = this.tour;
    if (!tour) return;
    const dt = tour.last === null ? 0 : Math.min(MAX_FRAME_SECONDS, (time - tour.last) / 1000);
    tour.last = time;
    const { input } = tour;
    const moving = input.forward !== 0 || input.turn !== 0 || input.strafe !== 0;
    if (moving) {
      tour.pose = stepTour(tour.pose, input, dt, tour.obstacles);
    }
    if (moving || tour.dirty) {
      tour.dirty = false;
      this.updateTourCamera(tour);
      this.draw();
    }
  }

  private updateTourCamera(tour: TourState): void {
    const { position, yaw } = tour.pose;
    const eye = new Vector3(position.x * CM_TO_M, EYE_HEIGHT_CM * CM_TO_M, position.y * CM_TO_M);
    const direction = new Vector3(
      Math.cos(yaw) * Math.cos(tour.pitch),
      Math.sin(tour.pitch),
      Math.sin(yaw) * Math.cos(tour.pitch),
    );
    this.camera.position.copy(eye);
    this.camera.lookAt(eye.add(direction));
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (!this.tour) return;
    this.tour.drag = { x: event.clientX, y: event.clientY, id: event.pointerId };
    this.renderer.domElement.setPointerCapture?.(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const tour = this.tour;
    if (!tour?.drag || tour.drag.id !== event.pointerId) return;
    const dx = event.clientX - tour.drag.x;
    const dy = event.clientY - tour.drag.y;
    tour.drag = { ...tour.drag, x: event.clientX, y: event.clientY };
    // "Grab the world" like panorama viewers: dragging left turns the view to the right.
    tour.pose = { ...tour.pose, yaw: tour.pose.yaw - dx * LOOK_SENSITIVITY };
    tour.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, tour.pitch + dy * LOOK_SENSITIVITY));
    tour.dirty = true;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.tour?.drag?.id === event.pointerId) this.tour.drag = null;
  };

  // ── Misc ────────────────────────────────────────────────────────────────

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.tour) this.tour.dirty = true;
    this.draw();
  }

  screenshot(): Promise<Blob | null> {
    this.draw();
    return new Promise((resolve) => this.renderer.domElement.toBlob(resolve, 'image/png'));
  }

  dispose(): void {
    this.stopTour();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.clearContent();
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.controls?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  // ── Scene construction ──────────────────────────────────────────────────

  /** Walls are merged per colour to keep the number of draw calls low. */
  private createWalls(walls: readonly ScenePrism[]): Mesh[] {
    const groups = new Map<string, BufferGeometry[]>();
    for (const wall of walls) {
      const geometry = new ExtrudeGeometry(planShape(wall.footprint, true), {
        depth: wall.height,
        bevelEnabled: false,
      });
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, wall.elevation, 0);
      const key = `${wall.kind}:${wall.color}`;
      groups.set(key, [...(groups.get(key) ?? []), geometry]);
    }
    return [...groups.entries()].flatMap(([key, geometries]) => {
      const [kind, color] = key.split(':');
      const material = this.material(kind === 'glass' ? 'glass' : 'matte', color, kind === 'wall' ? 0.95 : undefined);
      return this.mergedMeshes(geometries, material, kind !== 'glass');
    });
  }

  private mergedMeshes(geometries: BufferGeometry[], material: Material, shadows: boolean): Mesh[] {
    const merged = geometries.length > 1 ? mergeGeometries(geometries) : geometries[0];
    const list = merged ? [merged] : geometries;
    if (merged && merged !== geometries[0]) geometries.forEach((geometry) => geometry.dispose());
    return list.map((geometry) => {
      const mesh = new Mesh(geometry, material);
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      return mesh;
    });
  }

  private createSurface(surface: SceneSurface): Object3D {
    const isFloor = surface.kind === 'floor';
    const geometry = new ShapeGeometry(planShape(surface.polygon, isFloor));
    let material: Material;
    if (isFloor) {
      const texture = this.floorTexture(surface.color);
      material = this.material('wood', texture ? '#ffffff' : surface.color, 0.7, texture);
    } else {
      material = this.material('matte', surface.color, 0.95);
    }
    const mesh = new Mesh(geometry, material);
    // Floors face up, ceilings face down (and are therefore invisible from above).
    mesh.rotation.x = isFloor ? -Math.PI / 2 : Math.PI / 2;
    mesh.position.y = surface.height + (isFloor ? 0.1 : 0);
    mesh.receiveShadow = true;
    return mesh;
  }

  private createFurniture(item: SceneFurniture): Object3D {
    const group = new Group();
    group.position.set(item.x, item.elevation, item.y);
    // Plan rotation is clockwise with y pointing down (= +z in 3D) → negative rotation around +y.
    group.rotation.y = -degToRad(item.rotation);
    const byMaterial = new Map<string, { material: Material; geometries: BufferGeometry[]; shadows: boolean }>();
    for (const part of item.parts) {
      const geometry = this.partGeometry(part);
      const key = `${part.finish}:${part.color}`;
      const entry = byMaterial.get(key) ?? {
        material: this.material(part.finish, part.color),
        geometries: [],
        shadows: part.finish !== 'glass',
      };
      entry.geometries.push(geometry);
      byMaterial.set(key, entry);
    }
    byMaterial.forEach(({ material, geometries, shadows }) =>
      this.mergedMeshes(geometries, material, shadows).forEach((mesh) => group.add(mesh)),
    );
    return group;
  }

  private partGeometry(part: ModelPart): BufferGeometry {
    let geometry: BufferGeometry;
    let scale = new Vector3(1, 1, 1);
    switch (part.shape) {
      case 'box':
        geometry = new BoxGeometry(1, 1, 1);
        scale = new Vector3(part.w, part.h, part.d);
        break;
      case 'rounded':
        geometry = new RoundedBoxGeometry(part.w, part.h, part.d, 3, part.radius ?? 1);
        break;
      case 'cylinder':
        geometry = new CylinderGeometry(0.5 * (part.taper ?? 1), 0.5, 1, CYLINDER_SEGMENTS);
        scale = new Vector3(part.w, part.h, part.d);
        break;
      case 'sphere':
        geometry = new SphereGeometry(0.5, 20, 14);
        scale = new Vector3(part.w, part.h, part.d);
        break;
    }
    const rotation = new Quaternion().setFromEuler(new Euler(part.rotateX ?? 0, part.rotateY ?? 0, 0));
    geometry.applyMatrix4(new Matrix4().compose(new Vector3(part.x, part.y, part.z), rotation, scale));
    // Rounded boxes are not indexed; all parts must share the same layout to be merged.
    if (!geometry.index) return geometry;
    const flat = geometry.toNonIndexed();
    geometry.dispose();
    return flat;
  }

  private createGround(description: SceneDescription): Object3D {
    const size = Math.max(aabbWidth(description.bounds), aabbHeight(description.bounds)) + GROUND_MARGIN / CM_TO_M;
    const center = aabbCenter(description.bounds);
    const ground = new Mesh(new PlaneGeometry(size, size), this.material('matte', GROUND_HEX, 1));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(center.x, -0.2, center.y);
    ground.receiveShadow = true;
    return ground;
  }

  private floorTexture(color: string): Texture | null {
    if (!this.textures.has(color)) {
      const texture = plankTexture(color);
      if (!texture) return null;
      this.textures.set(color, texture);
    }
    return this.textures.get(color) ?? null;
  }

  private material(finish: Finish, color: string, roughness?: number, map: Texture | null = null): Material {
    const key = `${finish}:${color}:${roughness ?? ''}:${map ? map.uuid : ''}`;
    let material = this.materials.get(key);
    if (!material) {
      const params: MeshStandardMaterialParameters = { ...FINISHES[finish], color, side: FrontSide };
      if (roughness !== undefined) params.roughness = roughness;
      if (map) params.map = map;
      if (finish === 'emissive') params.emissive = new Color(color);
      if (finish === 'glass') params.side = DoubleSide;
      material = new MeshStandardMaterial(params);
      this.materials.set(key, material);
    }
    return material;
  }

  private fitSun(description: SceneDescription): void {
    const center = aabbCenter(description.bounds);
    const extent =
      Math.max(aabbWidth(description.bounds), aabbHeight(description.bounds), description.maxHeight) * CM_TO_M;
    this.sun.position.set(
      center.x * CM_TO_M + extent * SUN_OFFSET.x,
      extent * SUN_OFFSET.y,
      center.y * CM_TO_M + extent * SUN_OFFSET.z,
    );
    this.sun.target.position.set(center.x * CM_TO_M, 0, center.y * CM_TO_M);
    const shadowCamera = this.sun.shadow.camera;
    shadowCamera.left = -extent;
    shadowCamera.right = extent;
    shadowCamera.top = extent;
    shadowCamera.bottom = -extent;
    shadowCamera.near = 0.1;
    shadowCamera.far = extent * 4;
    shadowCamera.updateProjectionMatrix();
  }

  private clearContent(): void {
    this.content.traverse((object) => {
      if (object instanceof Mesh) (object.geometry as BufferGeometry).dispose();
    });
    this.content.clear();
  }

  private draw(): void {
    this.renderer.render(this.scene, this.camera);
  }
}

export function isWebGlAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
