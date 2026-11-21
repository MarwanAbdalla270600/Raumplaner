import { computed, inject, Injectable, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ProjectStore } from '../../project/application/project-store';
import { FurnitureCategory } from '../../project/domain/model';
import {
  CatalogEntry,
  CatalogItem,
  filterCatalog,
  fromCatalogEntry,
  fromCustomDefinition,
} from '../domain/catalog-item';
import { CATALOG_LOADER } from '../infrastructure/catalog-loader';

@Injectable({ providedIn: 'root' })
export class CatalogStore {
  private readonly loader = inject(CATALOG_LOADER);
  private readonly i18n = inject(I18nService);
  private readonly projectStore = inject(ProjectStore);
  private readonly entries = signal<readonly CatalogEntry[]>([]);
  private loading: Promise<void> | null = null;

  readonly query = signal('');
  readonly category = signal<FurnitureCategory | 'all'>('all');
  readonly error = signal<string | null>(null);

  readonly items = computed<CatalogItem[]>(() => {
    const locale = this.i18n.locale();
    const custom = (this.projectStore.project()?.customCatalog ?? []).map(fromCustomDefinition);
    return [...custom, ...this.entries().map((entry) => fromCatalogEntry(entry, locale))];
  });

  readonly filtered = computed(() => filterCatalog(this.items(), { query: this.query(), category: this.category() }));

  ensureLoaded(): Promise<void> {
    this.loading ??= this.loader
      .load()
      .then((entries) => this.entries.set(entries))
      .catch((error: unknown) => {
        this.loading = null;
        this.error.set(error instanceof Error ? error.message : String(error));
      });
    return this.loading;
  }

  find(id: string): CatalogItem | undefined {
    return this.items().find((item) => item.id === id);
  }
}
