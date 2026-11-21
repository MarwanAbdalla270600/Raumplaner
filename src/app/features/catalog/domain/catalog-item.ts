import { CustomFurnitureDefinition, FurnitureCategory, FurnitureSpec } from '../../project/domain/model';

export type LocalizedText = Readonly<Record<string, string>>;

/** Entry of the built-in catalog (names are localised). */
export interface CatalogEntry extends Omit<FurnitureSpec, 'name'> {
  readonly id: string;
  readonly name: LocalizedText;
}

/** Catalog item as shown in the UI, independent of its source. */
export interface CatalogItem {
  readonly id: string;
  readonly source: 'builtin' | 'custom';
  readonly spec: FurnitureSpec;
}

const FALLBACK_LOCALE = 'de';

export function localize(text: LocalizedText, locale: string): string {
  return text[locale] ?? text[FALLBACK_LOCALE] ?? Object.values(text)[0] ?? '';
}

export function fromCatalogEntry(entry: CatalogEntry, locale: string): CatalogItem {
  const { id, name, ...rest } = entry;
  return { id, source: 'builtin', spec: { ...rest, name: localize(name, locale) } };
}

export function fromCustomDefinition(definition: CustomFurnitureDefinition): CatalogItem {
  const { id, ...spec } = definition;
  return { id, source: 'custom', spec };
}

export interface CatalogFilter {
  readonly query: string;
  readonly category: FurnitureCategory | 'all';
}

export function filterCatalog(items: readonly CatalogItem[], filter: CatalogFilter): CatalogItem[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return items.filter(
    (item) =>
      (filter.category === 'all' || item.spec.category === filter.category) &&
      (query === '' || item.spec.name.toLocaleLowerCase().includes(query)),
  );
}
