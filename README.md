# Raumplaner

Lokal lauffähige Webanwendung zur Innenraumplanung ganzer Wohnungen: Räume konfigurieren,
Türen und Fenster setzen, Möbel per Drag & Drop platzieren und das Ergebnis in 3D ansehen.
Kein Backend – alle Daten bleiben im Browser (IndexedDB, Fallback localStorage).

## Schnellstart

Voraussetzungen: Node.js ≥ 22, npm ≥ 10.

```bash
npm install
npm start            # http://localhost:4200
```

| Befehl                            | Zweck                                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm start`                       | Dev-Server mit Live-Reload                                                                                                |
| `npm run build`                   | Produktions-Build nach `dist/interior-design`                                                                             |
| `npm test`                        | Unit- und Komponententests (Vitest über `ng test`)                                                                        |
| `npm run test:watch`              | Tests im Watch-Modus                                                                                                      |
| `npm run e2e`                     | End-to-End-Tests (Playwright, Desktop + Mobile; startet den Dev-Server selbst). Einmalig vorher: `npx playwright install` |
| `npm run lint`                    | ESLint (inkl. Angular-Template- und Barrierefreiheitsregeln)                                                              |
| `npm run format` / `format:check` | Prettier                                                                                                                  |

Den Produktions-Build kann man mit einem beliebigen statischen Server ausliefern,
z. B. `npx http-server dist/interior-design/browser`.

## Funktionen

- **Projekte**: anlegen, umbenennen, löschen, als JSON exportieren/importieren; Autosave.
- **2D-Grundriss** (SVG): Räume als beliebige Vielecke – per Formular mit Vorlagen (Rechteck,
  L-, U-, T-Form, abgeschrägte Ecke), als Rechteck aufziehen oder Ecke für Ecke anklicken.
  Ecken lassen sich ziehen, auf Wandmitten einfügen und per Doppelklick entfernen.
  Etagen, Türen/Fenster je Wand, Einheiten cm/m, Raster mit Snapping, Wandlängen, Abstände
  zu Wänden/Möbeln.
- **Wohnung zusammensetzen**: Räume kleben beim Verschieben und Zeichnen Wand an Wand aneinander
  (die Wand wird geteilt, hervorgehobene Kante zeigt das Andocken). „Anbauen“ im
  Eigenschaftenpanel setzt an einer Wand direkt einen neuen Raum samt Tür an.
- **Möbel**: Katalog (JSON) mit 27 Standardmöbeln, eigene Möbel, platzieren (Klick oder Drag aus dem
  Katalog), verschieben, drehen (90°-Schritte, frei per Griff/Slider), skalieren (Griff oder exakte
  Werte), duplizieren, löschen, Ebenen/Z-Reihenfolge und Höhe über Boden zum Stapeln,
  Kollisionswarnung.
- **Interaktion**: Maus, Touch und Tastatur; Mehrfachauswahl (Shift-Klick, Shift + Ziehen für Auswahlrahmen, Long-Press);
  Zoom per Mausrad/Pinch; Ansicht verschieben durch Ziehen auf freier Fläche (Maus oder Finger).
- **3D-Ansicht** (Three.js, lazy geladen): Wände mit Öffnungen (gemeinsame Wände werden nur einmal
  gebaut, Türen gehen durch beide Hälften), Holzdielen-Boden, Decke, Schatten, Orbit-Steuerung,
  Kamera-Presets und PNG-Screenshot.
- **Möbel in 3D**: prozedurale Modelle statt Blöcken – Bett mit Matratze, Kissen und Decke,
  Kleiderschrank mit Türen und Griffen, Regal mit Büchern, Sofa/Sessel mit Polstern, Küchenzeile
  mit Kochfeld und Spüle, Bad (WC, Waschtisch, Wanne, Dusche), Pflanze, Stehlampe, TV u. a.
  Eigene Möbel bekommen über Namen (z. B. „Bücherregal“) oder Kategorie ein passendes Modell.
- **3D-Rundgang**: in Augenhöhe durch die Wohnung gehen – Navigationspfeile auf dem Bildschirm
  (gedrückt halten, auch per Touch), Pfeiltasten/WASD, Ziehen zum Umsehen, Raumwahl zum
  Hineinspringen. Wände sind nicht passierbar, Türen schon.
- **Design System** mit Tokens, Light/Dark-Theme, Basiskomponenten und Live-Doku unter
  [`/design-system`](http://localhost:4200/design-system).
- **Sprachen**: Deutsch (Standard) und Englisch, zur Laufzeit umschaltbar.

### Tastaturkürzel (im Grundriss)

| Taste                              | Aktion                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| `Entf` / `Backspace`               | Auswahl löschen                                                    |
| `Strg/⌘ + Z`                       | Rückgängig                                                         |
| `Strg/⌘ + Y`, `Strg/⌘ + Shift + Z` | Wiederholen                                                        |
| `Strg/⌘ + D`                       | Duplizieren                                                        |
| `Strg/⌘ + A`                       | Alle Möbel auswählen                                               |
| `R` / `Shift + R`                  | Um 90° rechts/links drehen (`Alt + R`: 15°)                        |
| Pfeiltasten                        | Verschieben um 1 cm (`Shift`: 10 cm)                               |
| `Esc`                              | Auswahl aufheben, Zeichenwerkzeug beenden                          |
| `Alt` beim Ziehen                  | Snapping vorübergehend aus                                         |
| `Enter` / Doppelklick              | Beim Zeichnen: Raum schließen (`Backspace`: letzte Ecke entfernen) |

### Rundgang (3D-Ansicht → „Rundgang“)

| Taste                      | Aktion                                                   |
| -------------------------- | -------------------------------------------------------- |
| `↑` / `W`, `↓` / `S`       | Vorwärts / rückwärts gehen                               |
| `←` / `→` (oder `Q` / `E`) | Drehen                                                   |
| `A` / `D`                  | Seitwärts gehen                                          |
| Maus/Finger ziehen         | Umsehen                                                  |
| `Esc`                      | Rundgang beenden (zweites `Esc` schließt die 3D-Ansicht) |

## Architektur

Ausführlich mit Begründungen: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
src/app
├── core            Shared Kernel: Geometrie, Einheiten, Command-History, i18n, Theme, Breakpoints
├── design-system   Tokens (CSS Custom Properties) + Basiskomponenten + Showcase
└── features
    ├── project     Modell, Validierung, Migration, Commands, ProjectStore, Repositories, Projektliste
    ├── catalog     Katalog-Modell, Loader (public/catalog/furniture.json), Store, Panel, Dialog
    ├── editor      Viewport, Snapping, Kollision, Maße, Shortcuts, Use Cases, SVG-Canvas, Panels
    └── viewer-3d   Szenenbeschreibung, Kamera-Presets, Three.js-Adapter, Viewer
```

Jedes Feature ist in `domain` (reines TypeScript, ohne Angular), `application` (Use Cases,
Signal-Stores, Commands), `infrastructure` (Persistenz, Three.js, Fetch) und `presentation`
(Komponenten) geschichtet. ESLint erzwingt, dass `domain` weder Angular noch Three.js noch äußere
Schichten importiert und dass `three` nur in `viewer-3d/infrastructure` vorkommt.

Technische Eckpunkte:

- Angular 22, Standalone Components, Signals (`signal`, `computed`, `input`, `model`, `output`),
  neue Control-Flow-Syntax, **zoneless** Change Detection, überall `OnPush`.
- Zustand: `ProjectStore` (Signals) + **Command Pattern** für Undo/Redo
  (`core/application/command-history.ts`). Drag-Gesten erzeugen eine transiente Vorschau und erst
  beim Loslassen _einen_ Command.
- Grenzen über `InjectionToken`: `PROJECT_REPOSITORY`, `CATALOG_LOADER`, `SCENE_RENDERER_FACTORY`.
- 3D und Three.js liegen in einem eigenen Lazy-Chunk (`@defer`), das Initial-Bundle bleibt bei
  ≈ 80 kB (gzip).
- Performance: Pointer-Moves werden per `requestAnimationFrame` gebündelt, Kollision nutzt einen
  AABB-Vorfilter + SAT. Der E2E-Test `e2e/performance.spec.ts` zieht ein Möbel in einem Raum mit 120
  Möbeln und prüft die Frame-Zeiten (gemessen: Ø 16,8 ms ≙ 60 fps).

## Datenformat

Alle Längen in **Zentimetern**, Winkel in Grad (im Uhrzeigersinn), Farben als `#rrggbb`.
Koordinatensystem des Grundrisses: x nach rechts, y nach unten.

Export-Datei (`*.raumplaner.json`):

```jsonc
{
  "format": "raumplaner.project", // Kennung, wird beim Import geprüft
  "schemaVersion": 2, // Version des Schemas, ältere Stände werden migriert
  "exportedAt": "2026-11-21T10:00:00.000Z",
  "project": {
    "id": "project_…",
    "name": "Meine Wohnung",
    "schemaVersion": 2,
    "createdAt": "…",
    "updatedAt": "…",
    "settings": { "unit": "cm", "gridSize": 10, "snapEnabled": true, "showDimensions": true },
    "customCatalog": [
      {
        "id": "custom_…",
        "name": "Klavier",
        "category": "other",
        "width": 150,
        "depth": 60,
        "height": 130,
        "color": "#222222",
        "material": "Holz",
        "weight": 250,
      },
    ],
    "floors": [
      {
        "id": "floor_…",
        "name": "Erdgeschoss",
        "level": 0,
        "rooms": [
          {
            "id": "room_…",
            "name": "Wohnzimmer",
            // Innenkontur (Boden) im Uhrzeigersinn; Wand i verläuft von points[i] nach points[i+1]
            // und liegt außerhalb der Kontur (Dicke wallThickness).
            "points": [
              { "x": 0, "y": 0 },
              { "x": 400, "y": 0 },
              { "x": 400, "y": 350 },
              { "x": 0, "y": 350 },
            ],
            "height": 250,
            "wallThickness": 12,
            "floorColor": "#d9c4a5",
            "wallColor": "#f2efe9",
            "openings": [
              {
                "id": "door_…",
                "kind": "door",
                "wall": 2, // Index der Wand
                "offset": 155, // ab Wandanfang (points[wall]) entlang der Wand
                "width": 90,
                "height": 205,
                "sillHeight": 0,
              },
            ],
          },
        ],
        "furniture": [
          {
            "id": "item_…",
            "catalogId": "sofa-3",
            "name": "Sofa (3-Sitzer)",
            "category": "seating",
            "x": 200,
            "y": 175, // Mittelpunkt
            "width": 220,
            "depth": 95,
            "height": 85,
            "rotation": 0,
            "elevation": 0,
            "layer": 1,
            "color": "#5b6c8f",
            "material": "Stoff",
            "weight": 70,
          },
        ],
      },
    ],
  },
}
```

Beim Import wird das Dokument strukturell validiert (`project-validation.ts`); Fehler werden mit
Pfad gemeldet (z. B. `project.settings.unit: cm or m expected`). Dokumente mit neuerer
`schemaVersion` werden abgelehnt, ältere über `project-migration.ts` angehoben (v1 → v2:
rechteckige Räume mit `x/y/width/depth` und Wänden `north/east/south/west` werden zu Polygonen).

Katalogeinträge (`public/catalog/furniture.json`) haben dieselben Felder wie Möbel-Spezifikationen,
der Name ist jedoch lokalisiert: `"name": { "de": "Sofa", "en": "Sofa" }`.

## Browser-Unterstützung

Aktuelle Versionen von Chrome, Edge, Safari (inkl. iOS) und Firefox. Benötigt werden Pointer
Events, `<dialog>`, IndexedDB (sonst localStorage) und für die 3D-Ansicht WebGL.

## Weitere Dokumentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – Architektur, Datenmodell, Entscheidungen
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) – Tokens, Komponenten, Barrierefreiheit
