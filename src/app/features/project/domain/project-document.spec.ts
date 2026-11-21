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
      JSON.stringify({ format: PROJECT_DOCUMENT_FORMAT, schemaVersion: 1, exportedAt: '', project: broken }),
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
});
