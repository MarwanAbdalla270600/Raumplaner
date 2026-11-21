import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { AppPreferencesComponent } from '../../core/presentation/app-preferences';
import {
  BottomSheetComponent,
  ButtonComponent,
  CardComponent,
  ColorFieldComponent,
  DialogComponent,
  IconComponent,
  NumberFieldComponent,
  SelectComponent,
  SliderComponent,
  SwitchComponent,
  TabsComponent,
  TextFieldComponent,
  ToastService,
  TooltipDirective,
} from '../components';

/** Living documentation of tokens and base components (see also docs/DESIGN-SYSTEM.md). */
@Component({
  selector: 'app-design-system-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppPreferencesComponent,
    BottomSheetComponent,
    ButtonComponent,
    CardComponent,
    ColorFieldComponent,
    DialogComponent,
    IconComponent,
    NumberFieldComponent,
    RouterLink,
    SelectComponent,
    SliderComponent,
    SwitchComponent,
    TabsComponent,
    TextFieldComponent,
    TooltipDirective,
  ],
  templateUrl: './design-system-page.html',
  styleUrl: './design-system-page.scss',
})
export class DesignSystemPage {
  protected readonly i18n = inject(I18nService);
  protected readonly toasts = inject(ToastService);

  protected readonly colors = [
    'bg',
    'surface',
    'surface-sunken',
    'border',
    'text',
    'text-muted',
    'primary',
    'danger',
    'success',
    'warning',
  ];
  protected readonly spaces = [1, 2, 3, 4, 5, 6, 7];
  protected readonly radii = ['sm', 'md', 'lg', 'full'];
  protected readonly shadows = ['sm', 'md', 'lg'];
  protected readonly fontSizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];

  protected readonly text = signal('Wohnzimmer');
  protected readonly length = signal(240);
  protected readonly unit = signal('cm');
  protected readonly slider = signal(45);
  protected readonly toggle = signal(true);
  protected readonly color = signal('#3b6fe0');
  protected readonly dialogOpen = signal(false);
  protected readonly sheetOpen = signal(false);
  protected readonly showSheet = signal(false);
  protected readonly tab = signal('one');
  protected readonly tabs = [
    { id: 'one', label: 'Tab 1' },
    { id: 'two', label: 'Tab 2' },
    { id: 'three', label: 'Tab 3' },
  ];
}
