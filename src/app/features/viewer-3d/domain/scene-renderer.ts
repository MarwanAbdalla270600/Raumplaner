import { CameraPresetId } from './camera-presets';
import { SceneDescription } from './scene-description';
import { Room } from '../../project/domain/model';

/** Port for 3D rendering engines (implemented with Three.js in infrastructure). */
export interface SceneRenderer {
  mount(container: HTMLElement): void;
  render(scene: SceneDescription): void;
  applyPreset(preset: CameraPresetId, room: Room | null): void;
  resize(width: number, height: number): void;
  screenshot(): Promise<Blob | null>;
  dispose(): void;
}
