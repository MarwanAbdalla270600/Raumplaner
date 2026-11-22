# Architektur & Datenmodell

Dieses Dokument beschreibt die Architekturentscheidungen des Raumplaners und begründet sie.

## 1. Leitprinzipien

| Prinzip                       | Umsetzung                                                                                                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework-freie Fachlogik** | Alles unter `*/domain` ist reines TypeScript ohne Angular- oder Three.js-Importe. Damit ist die Logik (Kollision, Snapping, Maße, Undo/Redo) mit Vitest ohne TestBed testbar.                                                        |
| **Unveränderliche Daten**     | `Project`, `Floor`, `Room`, `FurnitureItem` sind `readonly`. Jede Änderung erzeugt ein neues Objekt. Das macht Signals günstig (Referenzvergleich), Undo/Redo trivial und verhindert versteckte Seiteneffekte.                       |
| **Eine kanonische Einheit**   | Alle Längen werden intern in **Zentimetern** gespeichert. `cm`/`m` sind reine Darstellungsfrage (`core/domain/units.ts`).                                                                                                            |
| **Grenzen über Interfaces**   | Persistenz (`ProjectRepository`), Katalog (`CatalogLoader`) und 3D (`SceneRenderer`) sind Interfaces, die per `InjectionToken` injiziert werden. Implementierungen sind austauschbar (IndexedDB ↔ localStorage, Fetch ↔ Testdouble). |
| **Explizite Seiteneffekte**   | State-Änderungen passieren ausschließlich über `ProjectStore.execute(command)`. Das einzige Effect mit I/O ist `AutosaveService` – bewusst isoliert und benannt.                                                                     |

## 2. Ordnerstruktur

```
src/app
├── core                     # Shared Kernel (feature-übergreifend)
│   ├── domain               # Geometrie (Vec2, AABB, SAT), Einheiten, IDs, Konstanten
│   ├── application          # Generische Command-History (Undo/Redo)
│   ├── i18n                 # Signal-basierte Übersetzung (de/en) + Pipe
│   ├── theme                # Light/Dark-Theme-Service
│   └── layout               # Breakpoint-Service (matchMedia → Signal)
├── design-system            # Tokens (CSS Custom Properties) + Basiskomponenten
└── features
    ├── project              # Projekt-Aggregat
    │   ├── domain           # Modell, Factory, Wand-/Öffnungsgeometrie, Validierung, Migration
    │   ├── application      # ProjectStore (Signals), Commands, Autosave
    │   ├── infrastructure   # IndexedDB-/localStorage-Repository, JSON-Import/Export
    │   └── presentation     # Projektübersicht (anlegen, umbenennen, löschen)
    ├── catalog              # Möbelkatalog
    │   ├── domain           # CatalogItem, Filterlogik
    │   ├── application      # CatalogStore (Standard + eigene Möbel)
    │   ├── infrastructure   # JSON-Loader (public/catalog/furniture.json)
    │   └── presentation     # Katalog-Panel, Dialog "Eigenes Möbel"
    ├── editor               # 2D-Grundriss-Editor
    │   ├── domain           # Viewport, Snapping, Kollision, Maße, Shortcuts, Auswahl
    │   ├── application      # EditorState, Use Cases (platzieren, drehen, skalieren, ...)
    │   └── presentation     # Seite, SVG-Canvas, Toolbar, Eigenschaftenpanel
    └── viewer-3d            # 3D-Ansicht (lazy)
        ├── domain           # Kamera-Presets, Szenenbeschreibung (reine Daten)
        ├── infrastructure   # Three.js-Adapter (einziger Ort mit `three`-Import)
        └── presentation     # Viewer-Komponente (per @defer nachgeladen)
```

Abhängigkeitsregel: `presentation → application → domain`, `infrastructure → domain`.
`domain` importiert nie aus anderen Schichten. Features dürfen nur auf `domain` anderer Features
zugreifen (z. B. Editor nutzt `project/domain`).

## 3. Datenmodell

```ts
Project {
  id, name, schemaVersion, createdAt, updatedAt
  settings: { unit: 'cm' | 'm', gridSize, snapEnabled, showDimensions }
  floors: Floor[]                 // Etagen
  customCatalog: FurnitureSpec[]  // eigene Möbel (reisen beim Export mit)
}

Floor { id, name, level, rooms: Room[], furniture: FurnitureItem[] }

Room {
  id, name
  points: Vec2[]      // Innenkontur (Boden), ≥ 3 Ecken, im Uhrzeigersinn (y nach unten)
  height
  wallThickness       // Wände liegen außerhalb der Kontur, Ecken auf Gehrung
  floorColor, wallColor
  openings: Opening[]
}

Opening {
  id, kind: 'door' | 'window'
  wall                // Index der Wand: points[wall] → points[wall + 1]
  offset              // Abstand vom Wandanfang entlang der Innenseite
  width, height, sillHeight   // Brüstungshöhe (Tür = 0)
}

FurnitureItem {
  id, catalogId | null, name, category
  x, y                // Mittelpunkt (cm)
  width, depth, height
  rotation            // Grad, 0–360
  elevation           // Höhe über Boden (z. B. Lampe auf Tisch)
  layer               // Zeichenreihenfolge (Z-Order)
  color, material | null, weight | null
}
```

### Begründungen

- **Räume als Polygone (seit Schema v2).** Die Innenkontur ist die einzige gespeicherte Geometrie;
  Wände werden daraus _abgeleitet_ (`wallEdges`, `wallPolygon` in `room-geometry.ts`): jede Kante
  wird um `wallThickness` nach außen versetzt, Ecken werden auf Gehrung geschnitten. Dadurch gibt
  es keine inkonsistenten Zustände (Wand passt nicht zum Raum), und konkave Formen (L, U, T) sind
  ohne Sonderfälle möglich. Die Kontur wird immer im Uhrzeigersinn normalisiert (`withPoints`),
  damit „außen“ eindeutig ist.
- **Gemeinsame Wände statt Wand-Objekten.** Räume einer Wohnung werden so aneinandergeklebt, dass
  die Innenseite des einen Raums auf der Außenseite der Nachbarwand liegt (`room-snapping.ts`).
  Die 3D-Szene erkennt solche Paare (`sharedSpans`) und baut dort pro Raum nur die halbe Dicke in
  der eigenen Wandfarbe; Öffnungen des Nachbarn werden mit ausgeschnitten. So braucht es kein
  separates, zwischen Räumen geteiltes Wandmodell, und jeder Raum bleibt unabhängig verschiebbar.
- **Öffnungen gehören zu einer Wandseite** mit Offset statt freier Koordinaten: Eine Tür kann
  dadurch nie "neben" der Wand liegen, und beim Skalieren des Raumes bleibt sie korrekt.
- **Möbel gehören zur Etage, nicht zum Raum.** Möbel dürfen über Raumgrenzen hinweg verschoben
  werden; die Zuordnung zu einem Raum ist eine abgeleitete Abfrage. Verschiebt man einen Raum,
  werden die darin stehenden Möbel mitgenommen.
- **Mittelpunkt + Rotation** für Möbel: Drehen ist eine einzige Wertänderung; die Geometrie
  (Ecken, AABB) wird abgeleitet.
- **`elevation` + `height` statt nur Z-Index.** Kollision wird nur gemeldet, wenn sich Grundflächen
  _und_ Höhenintervalle überschneiden. Ein Fernseher (elevation 50) auf einem Lowboard (Höhe 50)
  kollidiert also nicht. `layer` bestimmt zusätzlich die 2D-Zeichenreihenfolge.
- **`schemaVersion`** im Projekt und im Export; `migrateProject()` hebt alte Stände an.

## 4. Zustand & Undo/Redo

- `ProjectStore` hält `project` als `signal<Project | null>`; alles andere (`activeFloor`,
  `canUndo`, …) ist `computed`.
- Jede fachliche Änderung ist ein **Command** (`apply(project) → project`,
  `revert(project) → project`). Commands sind reine Funktionen über unveränderlichen Daten und
  daher deterministisch testbar.
- `CommandHistory` ist ein unveränderlicher Wert `{ past, future }` mit Limit.
- Beim **Drag** wird _nicht_ pro Pointer-Event ein Command erzeugt: Der Editor hält eine
  transiente Vorschau (`EditorState.preview`), und erst beim Loslassen wird _ein_
  `UpdateFurnitureCommand` ausgeführt. So bleibt die History sauber und das Rendering schnell.

## 5. Rendering & Performance

- **2D in SVG**: native Trefferprüfung, Fokus/ARIA möglich, gestochen scharf beim Zoomen. Bei
  100+ Möbeln ist SVG mit `track`-basiertem `@for` und OnPush/zoneless problemlos 60 fps, weil pro
  Frame nur die Transform-Attribute der gezogenen Elemente neu geschrieben werden.
- Pointer-Moves werden per `requestAnimationFrame` gebündelt.
- Kollision: AABB-Vorfilter + Separating-Axis-Test (SAT) für gedrehte Rechtecke.
- **3D** wird per `@defer` geladen; `three` wird ausschließlich im Viewer-Chunk importiert und
  landet nicht im Initial-Bundle. Kein Wrapper (z. B. angular-three): Der Adapter ist klein,
  Three.js-Updates sind so unabhängig von einer Drittbibliothek, und die Schnittstelle
  `SceneRenderer` bleibt testbar.

### 3D-Möbel und Rundgang

- `furniture-models.ts` beschreibt jedes Möbel als Liste einfacher Teile (Box, abgerundete Box,
  Zylinder, Kugel) mit Oberfläche (Holz, Stoff, Metall, Keramik, Glas …) – reine Daten, ohne
  Three.js, und daher testbar. Das Modell wird über die Katalog-ID, sonst über Schlüsselwörter im
  Namen oder die Kategorie gewählt; Maße skalieren die Teile sinnvoll (z. B. Anzahl Schranktüren,
  Kissen, Sitzpolster). Der Adapter fügt die Teile pro Material zu wenigen Meshes zusammen.
- `walkthrough.ts` enthält Startpose, Bewegung und Kollision (Kreis gegen Wand-Prismen, Türen sind
  frei, Fensterbrüstungen blockieren) als reine Funktionen; der Renderer ruft sie pro Frame auf.
  Echte, detaillierte Modelle (glTF) ließen sich später über denselben Port ergänzen.

## 6. Persistenz

- `ProjectRepository` (Interface) mit `IndexedDbProjectRepository` und
  `LocalStorageProjectRepository` als Fallback (Auswahl in der Token-Factory).
- `AutosaveService` speichert entprellt (500 ms) nach jeder Änderung.
- Export/Import: `{ format: 'raumplaner.project', schemaVersion, exportedAt, project }`;
  Import validiert strukturell (`validateProjectDocument`) und migriert.

## 7. i18n

Laufzeit-Umschaltung de/en über einen Signal-basierten `I18nService` und die `t`-Pipe. Schlüssel
sind typisiert (`TranslationKey`), sodass fehlende englische Übersetzungen zu Compile-Fehlern
führen. Ein späterer Wechsel auf `@angular/localize` ist möglich, weil alle Texte bereits
zentral als Schlüssel vorliegen.
