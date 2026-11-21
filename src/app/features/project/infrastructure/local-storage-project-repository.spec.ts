import { project } from '../../../testing/fixtures';
import { LocalStorageProjectRepository } from './local-storage-project-repository';

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

describe('LocalStorageProjectRepository', () => {
  it('saves, lists, loads and deletes projects', async () => {
    const repository = new LocalStorageProjectRepository(new MemoryStorage());
    const older = project({ id: 'p1', updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = project({ id: 'p2', name: 'Neu', updatedAt: '2026-03-01T00:00:00.000Z' });
    await repository.save(older);
    await repository.save(newer);

    expect((await repository.list()).map((summary) => summary.id)).toEqual(['p2', 'p1']);
    expect(await repository.load('p1')).toEqual(older);

    await repository.delete('p1');
    expect(await repository.load('p1')).toBeNull();
  });

  it('skips corrupted entries', async () => {
    const storage = new MemoryStorage();
    storage.setItem('raumplaner.project.broken', '{"id": 1}');
    expect(await new LocalStorageProjectRepository(storage).list()).toEqual([]);
  });
});
