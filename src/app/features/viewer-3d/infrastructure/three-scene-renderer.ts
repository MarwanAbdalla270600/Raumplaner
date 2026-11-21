import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  FrontSide,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { aabbCenter, aabbHeight, aabbWidth, degToRad } from '../../../core/domain/geometry';
import { Room } from '../../project/domain/model';
import { cameraPose, CameraPresetId } from '../domain/camera-presets';
import { SceneBox, SceneDescription, SceneSurface } from '../domain/scene-description';
import { SceneRenderer } from '../domain/scene-renderer';

/** Three.js works in metres here; the domain uses centimetres. */
const CM_TO_M = 0.01;
const FIELD_OF_VIEW = 50;
const NEAR_PLANE = 0.05;
const FAR_PLANE = 500;
const SHADOW_MAP_SIZE = 2048;
const GROUND_MARGIN = 20;
const SKY_COLOR = 0xdfe8f2;
const GROUND_COLOR = 0xb9b3a7;
const BACKGROUND_COLOR = 0xe9edf2;
const SUN_OFFSET = { x: 0.6, y: 1.4, z: 0.9 } as const;
const MAX_PIXEL_RATIO = 2;
const GLASS_OPACITY = 0.35;
const EDGE_OPACITY = 0.25;

/** Adapter that turns a framework-free SceneDescription into a Three.js scene. */
export class ThreeSceneRenderer implements SceneRenderer {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(FIELD_OF_VIEW, 1, NEAR_PLANE, FAR_PLANE);
  private readonly content = new Group();
  private readonly sun = new DirectionalLight(0xffffff, 2.2);
  private controls: OrbitControls | null = null;
  private description: SceneDescription | null = null;
  private readonly materials = new Map<string, Material>();

  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene.background = new Color(BACKGROUND_COLOR);
    this.scene.add(new HemisphereLight(SKY_COLOR, GROUND_COLOR, 1.1));
    this.scene.add(new AmbientLight(0xffffff, 0.35));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target, this.content);
  }

  mount(container: HTMLElement): void {
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener('change', () => this.draw());
    this.controls.screenSpacePanning = true;
  }

  render(description: SceneDescription): void {
    this.description = description;
    this.clearContent();
    description.surfaces.forEach((surface) => this.content.add(this.createSurface(surface)));
    description.boxes.forEach((box) => this.content.add(this.createBox(box)));
    this.content.add(this.createGround(description));
    this.fitSun(description);
    this.draw();
  }

  applyPreset(preset: CameraPresetId, room: Room | null): void {
    if (!this.description) return;
    const pose = cameraPose(preset, this.description.bounds, room);
    this.camera.position.set(pose.position.x * CM_TO_M, pose.position.y * CM_TO_M, pose.position.z * CM_TO_M);
    this.controls?.target.set(pose.target.x * CM_TO_M, pose.target.y * CM_TO_M, pose.target.z * CM_TO_M);
    this.controls?.update();
    this.draw();
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.draw();
  }

  screenshot(): Promise<Blob | null> {
    this.draw();
    return new Promise((resolve) => this.renderer.domElement.toBlob(resolve, 'image/png'));
  }

  dispose(): void {
    this.clearContent();
    this.materials.forEach((material) => material.dispose());
    this.controls?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ── Scene construction ──────────────────────────────────────────────────

  private createBox(box: SceneBox): Object3D {
    const geometry = new BoxGeometry(box.width * CM_TO_M, box.height * CM_TO_M, box.depth * CM_TO_M);
    const mesh = new Mesh(geometry, this.material(box));
    mesh.position.set(box.x * CM_TO_M, (box.elevation + box.height / 2) * CM_TO_M, box.y * CM_TO_M);
    // Plan rotation is clockwise with y pointing down (= +z in 3D) → negative rotation around +y.
    mesh.rotation.y = -degToRad(box.rotation);
    mesh.castShadow = box.kind !== 'glass';
    mesh.receiveShadow = box.kind !== 'glass';
    if (box.kind === 'furniture') {
      const edges = new LineSegments(
        new EdgesGeometry(geometry),
        new LineBasicMaterial({ color: 0x000000, transparent: true, opacity: EDGE_OPACITY }),
      );
      mesh.add(edges);
    }
    return mesh;
  }

  private createSurface(surface: SceneSurface): Object3D {
    const width = aabbWidth(surface.bounds) * CM_TO_M;
    const depth = aabbHeight(surface.bounds) * CM_TO_M;
    const center = aabbCenter(surface.bounds);
    const mesh = new Mesh(
      new PlaneGeometry(width, depth),
      new MeshStandardMaterial({ color: surface.color, roughness: 0.9, side: FrontSide }),
    );
    // Floors face up, ceilings face down (so they are invisible from above).
    mesh.rotation.x = surface.kind === 'floor' ? -Math.PI / 2 : Math.PI / 2;
    mesh.position.set(
      center.x * CM_TO_M,
      surface.height * CM_TO_M + (surface.kind === 'floor' ? 0.001 : 0),
      center.y * CM_TO_M,
    );
    mesh.receiveShadow = true;
    return mesh;
  }

  private createGround(description: SceneDescription): Object3D {
    const size = Math.max(aabbWidth(description.bounds), aabbHeight(description.bounds)) * CM_TO_M + GROUND_MARGIN;
    const center = aabbCenter(description.bounds);
    const ground = new Mesh(
      new PlaneGeometry(size, size),
      new MeshStandardMaterial({ color: GROUND_COLOR, roughness: 1, side: DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(center.x * CM_TO_M, -0.002, center.y * CM_TO_M);
    ground.receiveShadow = true;
    return ground;
  }

  private material(box: SceneBox): Material {
    const key = `${box.kind}:${box.color}`;
    let material = this.materials.get(key);
    if (!material) {
      material =
        box.kind === 'glass'
          ? new MeshStandardMaterial({
              color: box.color,
              transparent: true,
              opacity: GLASS_OPACITY,
              roughness: 0.1,
              metalness: 0.1,
            })
          : new MeshStandardMaterial({ color: box.color, roughness: box.kind === 'wall' ? 0.95 : 0.7 });
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
      if (object instanceof Mesh || object instanceof LineSegments) {
        (object.geometry as BufferGeometry).dispose();
        if (object instanceof LineSegments) (object.material as Material).dispose();
      }
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
