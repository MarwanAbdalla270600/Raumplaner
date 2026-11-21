# Design System

Live-Dokumentation aller Tokens und Komponenten: Route `/design-system` (Link auf der Startseite).
Quellcode: `src/app/design-system`.

## Tokens

Definiert in `tokens/_tokens.scss` als CSS Custom Properties (Präfix `--ds-`).

| Gruppe | Tokens | Hinweise |
| --- | --- | --- |
| Farben (semantisch) | `color-bg`, `color-surface`, `color-surface-raised`, `color-surface-sunken`, `color-border`, `color-border-strong`, `color-text`, `color-text-muted`, `color-primary`, `color-primary-hover`, `color-primary-subtle`, `color-on-primary`, `color-danger`, `color-success`, `color-warning`, `color-focus`, `color-backdrop` | werden pro Theme umgeschaltet (`[data-theme='dark']`) |
| Canvas | `canvas-bg`, `canvas-grid`, `canvas-grid-major`, `canvas-wall`, `canvas-selection`, `canvas-collision`, `canvas-guide`, `canvas-dimension` | Farben des Grundrisses |
| Typografie | `font-family`, `font-mono`, `font-size-xs … 3xl`, `font-weight-*`, `line-height-*` | Skala ≈ 1,125–1,25 |
| Abstände | `space-0 … 7` | 4-px-Raster |
| Radien | `radius-sm`, `-md`, `-lg`, `-full` | |
| Schatten | `shadow-sm`, `-md`, `-lg` | im Dark Theme stärker |
| Z-Index | `z-base`, `z-raised`, `z-toolbar`, `z-sheet`, `z-overlay`, `z-dialog`, `z-toast`, `z-tooltip` | feste Ebenen statt Magic Numbers |
| Größen | `touch-target` (44 px), `control-height`, `control-height-sm`, `sidebar-width` | |
| Bewegung | `duration-fast`, `duration-normal`, `easing` | respektiert `prefers-reduced-motion` |

Komponenten verwenden ausschließlich semantische Tokens, nie Primitive (`--ds-blue-500` usw.).
Breakpoints (`tokens/_breakpoints.scss`): Tablet ab 768 px, Desktop ab 1100 px – gespiegelt in
`BreakpointService` für Layout-Entscheidungen in TypeScript.

## Komponenten

| Komponente | Selektor | API (Auszug) |
| --- | --- | --- |
| Button | `button[dsButton]`, `a[dsButton]` | `variant: primary \| secondary \| ghost \| danger`, `size: sm \| md`, `iconOnly`, `pressed` (setzt `aria-pressed`) |
| Icon | `ds-icon` | `name`, `size`; immer `aria-hidden` |
| TextField (Input) | `ds-text-field` | `label`, `[(value)]`, `(committed)` |
| NumberField mit Einheit | `ds-number-field` | `label`, `value` (Basiseinheit cm), `unit: cm \| m \| ° \| kg`, `min`, `max`, `step`, `(valueChange)` – rechnet Einheiten um, akzeptiert Dezimalkomma, Pfeiltasten (+Shift) |
| Select | `ds-select` | `label`, `options`, `[(value)]`, `hideLabel` |
| Slider | `ds-slider` | `label`, `min`, `max`, `step`, `suffix`, `[(value)]`, `(committed)` |
| ColorField | `ds-color-field` | `label`, `value`, `(valueChange)` |
| Switch | `ds-switch` | `label`, `[(checked)]`; `role="switch"` |
| Card | `ds-card` | `heading`, `interactive` |
| Dialog | `ds-dialog` | `heading`, `[(open)]`; Footer via `[dsDialogActions]`; nativer `<dialog>` (Fokusfalle, Escape) |
| Tooltip | `[dsTooltip]` | Text; Hover + Fokus, `aria-describedby`, Escape blendet aus |
| Toast | `ToastService.show(text, kind)` + `ds-toast-host` | `aria-live="polite"` |
| Tabs | `ds-tabs` | `tabs`, `[(selected)]`, `label`, `idPrefix`; Roving Tabindex, Pfeiltasten, Home/End |
| Bottom Sheet | `ds-bottom-sheet` | `heading`, `[(expanded)]`; Tippen, Enter/Space oder Wischen; eingeklappter Inhalt ist `inert` |

## Barrierefreiheit (WCAG AA)

* Kontraste: Text/Hintergrund-Paare beider Themes ≥ 4,5 : 1, UI-Elemente ≥ 3 : 1. Beschriftungen
  auf Möbeln und Raumböden wählen Schwarz/Weiß anhand der relativen Luminanz (`core/domain/color.ts`).
* Sichtbarer Fokus über `:focus-visible` (3 px Outline in `--ds-color-focus`).
* Alle Bedienelemente per Tastatur erreichbar; der Grundriss ist fokussierbar (`role="application"`)
  und vollständig per Tastaturkürzeln bedienbar, die Auswahl wird per `aria-live` angesagt.
* Icon-Buttons haben `aria-label`, Formularfelder echte `<label for>`-Verknüpfungen.
* Trefferflächen ≥ 44 px auf Touch-Geräten (`--ds-touch-target`); auf Geräten mit feinem Zeiger
  dürfen kompakte Varianten 32 px groß sein.
* Skip-Link „Zum Inhalt springen“, `lang`-Attribut folgt der gewählten Sprache.
* ESLint prüft Templates mit `templateAccessibility`.
