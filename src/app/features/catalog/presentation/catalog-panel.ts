import { ChangeDetectionStrategy, Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { formatLength } from '../../../core/domain/units';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../core/i18n/translations/de';
import { ButtonComponent, IconComponent, SelectComponent, TextFieldComponent } from '../../../design-system/components';
import { ProjectStore } from '../../project/application/project-store';
import { FURNITURE_CATEGORIES, FurnitureCategory, FurnitureSpec } from '../../project/domain/model';
import { CatalogStore } from '../application/catalog-store';
import { CatalogItem } from '../domain/catalog-item';
import { CustomFurnitureDialogComponent } from './custom-furniture-dialog';

export const CATALOG_DRAG_MIME = 'application/x-raumplaner-catalog';

@Component({
  selector: 'app-catalog-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CustomFurnitureDialogComponent, IconComponent, SelectComponent, TextFieldComponent],
  template: `
    <div class="filters">
      <ds-text-field type="search" [label]="i18n.t('catalog.search')" [(value)]="catalog.query" />
      <ds-select
        [label]="i18n.t('catalog.category')"
        [options]="categoryOptions()"
        [value]="catalog.category()"
        (valueChange)="setCategory($event)"
      />
    </div>
    <p class="hint">{{ i18n.t('catalog.dragHint') }}</p>
    @if (catalog.error()) {
      <p class="error" role="alert">{{ i18n.t('catalog.loadError') }}</p>
    }
    <ul class="list" role="list">
      @for (item of catalog.filtered(); track item.id) {
        <li>
          <button
            type="button"
            class="entry"
            draggable="true"
            [attr.aria-label]="i18n.t('catalog.add', { name: item.spec.name })"
            [attr.data-testid]="'catalog-' + item.id"
            (click)="place.emit(item)"
            (dragstart)="onDragStart($event, item)"
          >
            <span class="swatch" [style.background]="item.spec.color" aria-hidden="true"></span>
            <span class="text">
              <span class="name">
                {{ item.spec.name }}
                @if (item.source === 'custom') {
                  <span class="badge">{{ i18n.t('catalog.customBadge') }}</span>
                }
              </span>
              <span class="dims">{{ dimensions(item.spec) }}</span>
            </span>
            <ds-icon name="plus" [size]="18" />
          </button>
        </li>
      }
    </ul>
    <button dsButton class="custom" (click)="dialogOpen.set(true)" data-testid="create-custom">
      <ds-icon name="plus" /> {{ i18n.t('catalog.createCustom') }}
    </button>
    <app-custom-furniture-dialog [(open)]="dialogOpen" (created)="created.emit($event)" />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--ds-space-3);
      min-height: 0;
    }
    .filters {
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--ds-space-2);
    }
    .hint {
      margin: 0;
      font-size: var(--ds-font-size-xs);
      color: var(--ds-color-text-muted);
    }
    .error {
      color: var(--ds-color-danger);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: var(--ds-space-1);
      margin: 0;
      padding: 0;
      list-style: none;
      overflow-y: auto;
      min-height: 0;
    }
    .entry {
      display: flex;
      align-items: center;
      gap: var(--ds-space-3);
      width: 100%;
      min-height: 52px;
      padding: var(--ds-space-2);
      border: 1px solid transparent;
      border-radius: var(--ds-radius-md);
      background: none;
      color: var(--ds-color-text);
      font: inherit;
      text-align: left;
      cursor: grab;
    }
    .entry:hover {
      background: var(--ds-color-surface-sunken);
      border-color: var(--ds-color-border);
    }
    .swatch {
      flex: 0 0 auto;
      width: 28px;
      height: 28px;
      border-radius: var(--ds-radius-sm);
      border: 1px solid var(--ds-color-border-strong);
    }
    .text {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .name {
      font-size: var(--ds-font-size-sm);
      font-weight: var(--ds-font-weight-medium);
    }
    .dims {
      font-size: var(--ds-font-size-xs);
      color: var(--ds-color-text-muted);
    }
    .badge {
      margin-left: var(--ds-space-1);
      padding: 0 var(--ds-space-1);
      border-radius: var(--ds-radius-sm);
      background: var(--ds-color-primary-subtle);
      color: var(--ds-color-primary);
      font-size: var(--ds-font-size-xs);
    }
  `,
})
export class CatalogPanelComponent implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly catalog = inject(CatalogStore);
  private readonly store = inject(ProjectStore);

  readonly place = output<CatalogItem>();
  readonly created = output<FurnitureSpec>();
  protected readonly dialogOpen = signal(false);

  protected readonly categoryOptions = computed(() => [
    { value: 'all', label: this.i18n.t('catalog.all') },
    ...FURNITURE_CATEGORIES.map((category) => ({
      value: category,
      label: this.i18n.t(`category.${category}` as TranslationKey),
    })),
  ]);

  ngOnInit(): void {
    void this.catalog.ensureLoaded();
  }

  protected setCategory(value: string): void {
    this.catalog.category.set(value === 'all' ? 'all' : (value as FurnitureCategory));
  }

  protected dimensions(spec: FurnitureSpec): string {
    const unit = this.store.settings()?.unit ?? 'cm';
    const locale = this.i18n.intlLocale();
    return [spec.width, spec.depth, spec.height].map((value) => formatLength(value, unit, locale)).join(' × ');
  }

  protected onDragStart(event: DragEvent, item: CatalogItem): void {
    event.dataTransfer?.setData(CATALOG_DRAG_MIME, item.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }
}
