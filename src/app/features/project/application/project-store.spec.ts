import { TestBed } from '@angular/core/testing';
import { floor, furniture, project } from '../../../testing/fixtures';
import { AddFurnitureCommand } from './commands';
import { ProjectStore } from './project-store';

describe('ProjectStore', () => {
  let store: ProjectStore;

  beforeEach(() => {
    store = TestBed.inject(ProjectStore);
    store.load(project({ floors: [floor({ id: 'f1' }), floor({ id: 'f2', name: 'OG', level: 1 })] }));
  });

  it('executes commands and exposes undo/redo availability', () => {
    expect(store.canUndo()).toBe(false);
    store.execute(new AddFurnitureCommand('f1', [furniture()]));
    expect(store.activeFloor()?.furniture.length).toBe(1);
    expect(store.canUndo()).toBe(true);

    store.undo();
    expect(store.activeFloor()?.furniture.length).toBe(0);
    expect(store.canRedo()).toBe(true);
  });

  it('switches floors', () => {
    store.selectFloor('f2');
    expect(store.activeFloor()?.name).toBe('OG');
  });

  it('keeps settings changes out of the undo history', () => {
    store.updateSettings({ unit: 'm' });
    expect(store.settings()?.unit).toBe('m');
    expect(store.canUndo()).toBe(false);
  });

  it('touches updatedAt on every change (drives autosave)', () => {
    const before = store.project()?.updatedAt;
    store.rename('Neu');
    expect(store.project()?.updatedAt).not.toBe(before);
    expect(store.project()?.name).toBe('Neu');
  });
});
