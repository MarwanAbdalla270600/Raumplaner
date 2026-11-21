import { TestBed } from '@angular/core/testing';
import { floor, furniture, project } from '../../../testing/fixtures';
import { ProjectStore } from '../../project/application/project-store';
import { EditorState } from './editor-state';
import { EditorUseCases } from './editor-use-cases';

describe('EditorUseCases', () => {
  let store: ProjectStore;
  let state: EditorState;
  let useCases: EditorUseCases;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EditorState, EditorUseCases] });
    store = TestBed.inject(ProjectStore);
    state = TestBed.inject(EditorState);
    useCases = TestBed.inject(EditorUseCases);
    store.load(project({ floors: [floor({ furniture: [furniture({ id: 'a', x: 100, y: 100 })] })] }));
  });

  const items = () => store.activeFloor()?.furniture ?? [];

  it('duplicates the selection and selects the copies', () => {
    state.selectFurniture(['a']);
    useCases.duplicateSelection();
    expect(items().length).toBe(2);
    expect(items()[1].x).toBe(120);
    expect([...state.selectedFurnitureIds()]).toEqual([items()[1].id]);
  });

  it('rotates, nudges and undoes step by step', () => {
    state.selectFurniture(['a']);
    useCases.rotateSelection(90);
    useCases.nudgeSelection({ x: 5, y: 0 });
    expect(items()[0]).toMatchObject({ rotation: 90, x: 105 });

    store.undo();
    expect(items()[0]).toMatchObject({ rotation: 90, x: 100 });
    store.undo();
    expect(items()[0].rotation).toBe(0);
    store.redo();
    expect(items()[0].rotation).toBe(90);
  });

  it('deletes the selection', () => {
    state.selectFurniture(['a']);
    useCases.deleteSelection();
    expect(items()).toEqual([]);
    expect(state.selection().kind).toBe('none');
    store.undo();
    expect(items().length).toBe(1);
  });

  it('clamps invalid dimensions from the properties panel', () => {
    useCases.updateFurniture(['a'], { width: -20, elevation: -5 });
    expect(items()[0]).toMatchObject({ width: 1, elevation: 0 });
  });

  it('adds rooms next to the existing ones', () => {
    const first = useCases.addRoom({ width: 300, depth: 300, height: 250 });
    const second = useCases.addRoom({ width: 200, depth: 300, height: 250 });
    expect(first).not.toBeNull();
    expect(second?.x).toBe((first?.x ?? 0) + 300 + 12);
  });

  it('highlights collisions in the derived state', () => {
    store.load(project({ floors: [floor({ furniture: [furniture({ id: 'a' }), furniture({ id: 'b', x: 10 })] })] }));
    expect([...(state.collisions()?.colliding ?? [])].sort()).toEqual(['a', 'b']);
  });
});
