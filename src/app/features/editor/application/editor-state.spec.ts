import { vec } from '../../../core/domain/geometry';
import { roomArea, roomOrigin, wallEdges } from '../../project/domain/room-geometry';
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
    expect(second && roomOrigin(second).x).toBe((first ? roomOrigin(first).x : 0) + 300 + 12);
  });

  it('creates rooms with predefined shapes', () => {
    const room = useCases.addRoom({ width: 400, depth: 300, height: 250, shape: 'l-shape', x: 0, y: 0 });
    expect(room?.points).toHaveLength(6);
    expect(room && roomArea(room)).toBe(400 * 300 - 200 * 150);
  });

  it('attaches a room to a wall with a shared wall and a door in one undo step', () => {
    const base = useCases.addRoom({ width: 400, depth: 300, height: 250, x: 0, y: 0 });
    const steps = store.history().past.length;
    const attached = base ? useCases.attachRoom(base.id, 1, 250) : null;
    expect(attached).not.toBeNull();
    expect(store.history().past.length).toBe(steps + 1);
    expect(attached && roomOrigin(attached)).toEqual({ x: 412, y: 0 });
    expect(attached?.openings).toHaveLength(1);
    const doorWall = attached ? wallEdges(attached)[attached.openings[0].wall] : null;
    expect(doorWall?.start.x).toBe(412);
  });

  it('closes an outline drawn point by point', () => {
    state.draft.set({
      points: [vec(0, 0), vec(300, 0), vec(300, 300), vec(150, 400), vec(0, 300), vec(0, 300)],
      cursor: null,
      guide: null,
    });
    const room = useCases.finishDraft();
    expect(room?.points).toHaveLength(5);
    expect(state.draft()).toBeNull();
  });

  it('rejects self-intersecting outlines', () => {
    state.draft.set({ points: [vec(0, 0), vec(300, 300), vec(300, 0), vec(0, 300)], cursor: null, guide: null });
    expect(useCases.finishDraft()).toBeNull();
  });

  it('removes the wall thickness of all rooms in one undo step and uses it for new rooms', () => {
    useCases.addRoom({ width: 400, depth: 300, height: 250, x: 0, y: 0 });
    useCases.addRoom({ width: 300, depth: 300, height: 250 });
    const steps = store.history().past.length;
    useCases.setFloorWallThickness(0);
    expect(store.history().past.length).toBe(steps + 1);
    expect(state.displayFloor()?.rooms.every((r) => r.wallThickness === 0)).toBe(true);
    const next = useCases.addRoom({ width: 200, depth: 200, height: 250 });
    expect(next?.wallThickness).toBe(0);
  });

  it('edits corners of a room', () => {
    const room = useCases.addRoom({ width: 400, depth: 300, height: 250, x: 0, y: 0 });
    if (!room) throw new Error('room expected');
    useCases.setVertex(room.id, 1, vec(450, 0));
    expect(state.displayFloor()?.rooms[0].points[1]).toEqual({ x: 450, y: 0 });
    useCases.removeVertex(room.id, 1);
    expect(state.displayFloor()?.rooms[0].points).toHaveLength(3);
  });

  it('highlights collisions in the derived state', () => {
    store.load(project({ floors: [floor({ furniture: [furniture({ id: 'a' }), furniture({ id: 'b', x: 10 })] })] }));
    expect([...(state.collisions()?.colliding ?? [])].sort()).toEqual(['a', 'b']);
  });
});
