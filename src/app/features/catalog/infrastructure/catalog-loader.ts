import { InjectionToken } from '@angular/core';
import { CatalogEntry } from '../domain/catalog-item';

/** Port for loading the built-in furniture catalog. */
export interface CatalogLoader {
  load(): Promise<readonly CatalogEntry[]>;
}

export const CATALOG_URL = 'catalog/furniture.json';

export class FetchCatalogLoader implements CatalogLoader {
  constructor(private readonly url: string) {}

  async load(): Promise<readonly CatalogEntry[]> {
    const response = await fetch(this.url);
    if (!response.ok) {
      throw new Error(`Catalog could not be loaded (${response.status})`);
    }
    const data = (await response.json()) as { items: CatalogEntry[] };
    return data.items;
  }
}

export const CATALOG_LOADER = new InjectionToken<CatalogLoader>('CATALOG_LOADER', {
  providedIn: 'root',
  factory: () => new FetchCatalogLoader(CATALOG_URL),
});
