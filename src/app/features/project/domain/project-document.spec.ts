import { project } from '../../../testing/fixtures';
import { parseProjectDocument, PROJECT_DOCUMENT_FORMAT, toProjectDocument } from './project-document';

describe('project document (JSON export/import)', () => {
  it('round-trips a project', () => {
    const original = project();
    const json = JSON.stringify(toProjectDocument(original, new Date('2026-02-02T00:00:00Z')));
    const result = parseProjectDocument(json);
    expect(result).toEqual({ ok: true, project: original });
  });

  it('rejects invalid JSON', () => {
    expect(parseProjectDocument('{nope')).toEqual({ ok: false, errors: ['document: invalid JSON'] });
  });

  it('rejects documents of another format', () => {
    const result = parseProjectDocument(JSON.stringify({ format: 'other', project: {} }));
    expect(result.ok).toBe(false);
  });

  it('reports precise validation errors', () => {
    const broken = { ...project(), settings: { ...project().settings, unit: 'inch' } };
    const result = parseProjectDocument(
      JSON.stringify({ format: PROJECT_DOCUMENT_FORMAT, schemaVersion: 2, exportedAt: '', project: broken }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(['project.settings.unit: cm or m expected']);
    }
  });

  it('rejects documents from a newer schema version', () => {
    const result = parseProjectDocument(
      JSON.stringify({ format: PROJECT_DOCUMENT_FORMAT, schemaVersion: 99, project: project() }),
    );
    expect(result).toEqual({ ok: false, errors: ['Unsupported schema version 99'] });
  });

  it('migrates rectangular rooms from schema version 1 to polygons', () => {
    const v1Room = {
      id: 'r',
      name: 'Alt',
      x: 100,
      y: 50,
      width: 400,
      depth: 300,
      height: 250,
      wallThickness: 12,
      floorColor: '#cccccc',
      wallColor: '#eeeeee',
      openings: [
        { id: 'n', kind: 'window', wall: 'north', offset: 10, width: 100, height: 100, sillHeight: 90 },
        { id: 's', kind: 'door', wall: 'south', offset: 10, width: 90, height: 200, sillHeight: 0 },
        { id: 'w', kind: 'door', wall: 'west', offset: 20, width: 80, height: 200, sillHeight: 0 },
      ],
    };
    const old = { ...project(), schemaVersion: 1, floors: [{ ...project().floors[0], rooms: [v1Room] }] };
    const result = parseProjectDocument(
      JSON.stringify({ format: PROJECT_DOCUMENT_FORMAT, schemaVersion: 1, project: old }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const migrated = result.project.floors[0].rooms[0];
    expect(result.project.schemaVersion).toBe(2);
    expect(migrated.points).toEqual([
      { x: 100, y: 50 },
      { x: 500, y: 50 },
      { x: 500, y: 350 },
      { x: 100, y: 350 },
    ]);
    expect(migrated.openings.map((o) => [o.wall, o.offset])).toEqual([
      [0, 10],
      [2, 300],
      [3, 200],
    ]);
    expect('x' in migrated).toBe(false);
  });
});
