import { CatalogItem, filterCatalog, localize } from './catalog-item';

const item = (id: string, name: string, category: CatalogItem['spec']['category']): CatalogItem => ({
  id,
  source: 'builtin',
  spec: { name, category, width: 1, depth: 1, height: 1, color: '#000000', material: null, weight: null },
});

describe('catalog', () => {
  const items = [item('1', 'Sofa', 'seating'), item('2', 'Bett', 'bed'), item('3', 'Sessel', 'seating')];

  it('filters by category and query', () => {
    expect(filterCatalog(items, { query: '', category: 'seating' }).map((i) => i.id)).toEqual(['1', '3']);
    expect(filterCatalog(items, { query: 'bet', category: 'all' }).map((i) => i.id)).toEqual(['2']);
  });

  it('localizes with fallback', () => {
    expect(localize({ de: 'Stuhl', en: 'Chair' }, 'en')).toBe('Chair');
    expect(localize({ de: 'Stuhl' }, 'fr')).toBe('Stuhl');
  });
});
