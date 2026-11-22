import { Polygon } from '../../../core/domain/geometry';
import { Room } from '../../project/domain/model';
import { CameraPresetId } from './camera-presets';
import { SceneDescription } from './scene-description';
import { TourInput, TourPose } from './walkthrough';

/** Port for 3D rendering engines (implemented with Three.js in infrastructure). */
export interface SceneRenderer {
  mount(container: HTMLElement): void;
  render(scene: SceneDescription): void;
  applyPreset(preset: CameraPresetId, room: Room | null): void;
  /** Switches to first-person mode at the given pose; `obstacles` block walking. */
  startTour(pose: TourPose, obstacles: readonly Polygon[]): void;
  setTourInput(input: TourInput): void;
  /** Current walker pose (null outside the tour). */
  tourPose(): TourPose | null;
  stopTour(): void;
  resize(width: number, height: number): void;
  screenshot(): Promise<Blob | null>;
  dispose(): void;
}
