# Engraving Text on Point — Feature Plan

## Goal

A Fusion 360 Python add-in that lets the user pick sketch points, place centered sketch text on each point, then extrude that text as **Cut** or **New Body**, with an optional target body. The UI is a **stock-looking table palette** (light default, dark, auto) that supports per-row text/height/font and **batch sequential text** with prefix/suffix.

---

## User flow

```
Toolbar button → Palette opens
  ↓
[Point] selection (multi-select sketch points) → rows appear in table (one per point)
  ↓
Fill Text / Height / Font (or enable Batch mode)
  ↓
Choose Extrude: Cut | New Body | (optional Join later)
  ↓
If Cut: enable Target Body picker
  ↓
Set Distance (+ optional direction)
  ↓
OK → transaction: create text + center constraints + extrude per row
```

Cancel / palette close cleans selection handlers and does not leave orphan geometry.

---

## Palette UI (stock Fusion look)

### Layout

Dockable HTML palette (`adsk.core.Palettes`), width ~340–400px, height flexible.

```
┌─────────────────────────────────────────────┐
│  Engraving Text on Point              [?] │  ← title bar (Fusion chrome)
├─────────────────────────────────────────────┤
│  ⊙ Point(s)     [ Select ]     3 selected   │  ← selection row + stock icon
│  ⬚ Target Body  [ Select ]     (Cut only)   │
├─────────────────────────────────────────────┤
│  Operation   (•) Cut  ( ) New Body          │
│  Distance    [ 1.0 mm ▼ ]                   │
│  Direction   (•) Positive  ( ) Negative     │
├─────────────────────────────────────────────┤
│  ☐ Batch sequence                           │
│    Prefix [PN-]  Start [1]  Digits [3]      │
│    Suffix [-A]   Step  [1]                  │
├─────────────────────────────────────────────┤
│  # │ Text        │ Ht    │ Font             │
│ ───┼─────────────┼───────┼──────────────────│
│  1 │ PN-001-A    │ 3 mm  │ Arial ▼          │  ← text input styled as selected font
│  2 │ PN-002-A    │ 3 mm  │ Arial ▼          │
│  3 │ PN-003-A    │ 3 mm  │ Courier New ▼    │
├─────────────────────────────────────────────┤
│  Theme  [ Light ▼ ]   Light | Dark | Auto   │  ← Light = default
├─────────────────────────────────────────────┤
│              [ Cancel ]  [ OK ]             │
└─────────────────────────────────────────────┘
```

### Table columns

| Column | Control | Notes |
|--------|---------|--------|
| `#` | Read-only index | Selection order |
| Text | `<input type="text">` | When batch on: auto-filled `prefix + padded(seq) + suffix`, still editable override |
| Height | Numeric + unit (mm default) | Synced to Fusion unit prefs where practical |
| Font | `<select>` | Options rendered **in that font**; selected value also applies to the Text input `font-family` |

### Batch sequence behavior

- Toggle **Batch sequence** on → Text column becomes driven by formula:
  - `display = prefix + str(start + i*step).zfill(digits) + suffix`
  - Example: `PN-` + `001` + `-A` → `PN-001-A`, `PN-002-A`, …
- Changing prefix/suffix/start/digits/step re-writes all non-overridden rows.
- Per-row “override” flag: user edits Text → that row stops auto-updating until batch is toggled off/on or “Reset batch texts” is clicked.
- Iteration order = order points were selected (stable).

### Stock Fusion visual language

- CSS variables matching Fusion palette chrome:
  - Light (default): `#F5F5F5` / `#FFFFFF` surfaces, `#3C3C3C` text, `#0696D7` accent (Fusion blue), 1px `#D0D0D0` rules, 2–3px radius (not pill).
  - Dark: `#333333` / `#3C3C3C` surfaces, `#F5F5F5` text, same accent.
- Typography: system UI stack that Fusion uses (`Artifakt Element` when available, else Segoe UI / system-ui). **Do not** use Inter/Roboto as brand.
- Controls: flat inputs, thin borders, compact 24–28px row height — no card chrome, no multi-layer shadows, no purple gradients.
- Section labels uppercase/small or left-aligned field labels like Parameters / Extrude dialogs.

### Theme: Light | Dark | Auto

| Mode | Behavior |
|------|----------|
| **Light** (default) | Force light tokens regardless of Fusion theme |
| Dark | Force dark tokens |
| Auto | Follow `app.preferences.generalPreferences.activeUserInterfaceTheme` (and listen / poll on palette show). Also respect `prefers-color-scheme` as secondary signal inside the web view |

Persist last theme choice in `adsk.core.Application` attribute / JSON under add-in folder (`settings.json`). Default file value = `"light"`.

---

## Icons

Prefer **built-in Fusion resource paths** via command/definition icons when the API exposes shared resources; otherwise ship local 16/32/64 PNGs.

| Action | Preferred stock | Fallback (Photoshop) |
|--------|-----------------|----------------------|
| Command (toolbar) | Extrude / Text-related Fusion glyph if available from `APISamples` / `Resources` packs | Custom: sketch point + “T” overlay, Fusion blue accent, 16/32/64 |
| Point select | Selection / SketchPoint style glyph | Point crosshair on light/dark variants |
| Body select | Body / BRep body glyph | Solid body silhouette |
| Cut operation | Extrude Cut glyph | Cutter + minus |
| New Body | New Body / Extrude New Body glyph | Plus + body |

Deliverables under `resources/icons/`:

```
resources/icons/
  command/16x16.png  32x32.png  64x64.png
  point/…
  body/…
  cut/…
  newbody/…
  README.md          ← source stock path OR “photoshopped from …” notes
```

Use 32-bit PNG with transparency; provide light and dark variants only if Fusion’s auto-swap needs `_dark` suffixes (match Fusion add-in icon naming conventions: `16x16-normal.png`, `16x16-dark.png` as required by target Fusion version).

---

## Geometry & API design

### 1. Point selection

- `SelectionCommandInput` or custom `SelectionEvent` filtered to `SketchPoint` (and optionally sketch origin / projected points).
- Multi-select; each accepted point → one table row + token `{ sketchEntityToken, pointEntityToken, component }`.
- Points must share a sketch **or** we group by parent sketch and process per-sketch (recommended: **allow multi-sketch**, process groups independently under one timeline group).

### 2. Create centered sketch text on point

Use modern multiline API (not retired `createInput`):

```python
height_vi = adsk.core.ValueInput.createByReal(height_cm)  # or createInput2(text, height)
tin = sketch.sketchTexts.createInput2(text, height_cm)
# Anchor box centered on point — half-extents from estimated text width
cx, cy = point.geometry.x, point.geometry.y
half_w, half_h = estimate_half_extents(text, height_cm, font)
tin.setAsMultiLine(
    adsk.core.Point3D.create(cx - half_w, cy - half_h, 0),
    adsk.core.Point3D.create(cx + half_w, cy + half_h, 0),
    adsk.core.HorizontalAlignments.CenterHorizontalAlignment,
    adsk.core.VerticalAlignments.MiddleVerticalAlignment,
    0)  # angle
tin.fontName = font_name
sk_text = sketch.sketchTexts.add(tin)
```

**Center constraint to the sketch point**

After add, use `MultiLineTextDefinition.rectangleLines` (replacement for retired `boundaryLines`):

1. Read the four rectangle lines from `sk_text.definition.rectangleLines`.
2. Derive midpoints / use midPoint constraints, **or** create two construction lines through box mid-X and mid-Y and coincident to the target `SketchPoint`.
3. Practical approach (proven in forum guidance):
   - Keep references to the four `SketchLine`s returned at creation time.
   - Add horizontal/vertical mid-point constraints so the rectangle center stays coincident with the selected point.
   - Optionally `GeometricConstraint.coincidents` between a helper center point and the seed point.

Fallback if rectangle constraints fail on a Fusion build: position text box mathematically at the point (still centered alignment) and skip associative constraint — log warning.

### 3. Extrude

Pass `SketchText` directly to extrude (not profiles):

```python
ext_in = extrudes.createInput(
    sk_text,
    adsk.fusion.FeatureOperations.CutFeatureOperation  # or NewBodyFeatureOperation
)
ext_in.setDistanceExtent(False, adsk.core.ValueInput.createByReal(dist_cm))
# Cut: optional participant bodies
if op == Cut and target_bodies:
    ext_in.participantBodies = target_bodies
extrudes.add(ext_in)
```

| Operation | `FeatureOperations` | Target body |
|-----------|---------------------|-------------|
| Cut | `CutFeatureOperation` | Optional `participantBodies`; if empty → all intersected |
| New Body | `NewBodyFeatureOperation` | N/A (hide body picker) |

All creates run inside one `design.timeline.timelineGroups.add(...)` named **Engraving Text on Point** for undo clarity. Prefer a single `Transaction` via command execute.

### 4. Fonts

- Populate dropdown from OS/Fusion-available fonts: try `TextFonts` / document text styles; seed with common engineering set (`Arial`, `Artifakt Element`, `Courier New`, `Times New Roman`, `Verdana`, …) and merge with discovered names.
- Validate `fontName` before add; on failure fall back to `Arial` and toast in palette status line.

### 5. Units

- Store internal values in cm (Fusion API native).
- Palette displays active design units (`design.unitsManager.defaultLengthUnits`).
- Height and distance inputs accept expressions where possible (`"3 mm"`, `"0.12 in"`).

---

## Architecture

```
EngravingTextOnPoint/
  EngravingTextOnPoint.py          # run/stop, command registration
  EngravingTextOnPoint.manifest
  commands/
    engraving_text_command.py      # CommandCreated / InputChanged / Execute
    selection_handlers.py          # Point + body filters
  lib/
    text_on_point.py               # create text + center constraints
    extrude_text.py                # cut / new body helpers
    batch_sequence.py              # prefix/suffix/seq formatting
    fonts.py                       # font discovery
    settings.py                    # theme + defaults persistence
    fusion_util.py                 # app/ui/design accessors, transactions
  resources/
    palette/                       # shipped with add-in (Fusion-relative paths)
      palette.html
      static/palette.css|js
    icons/…
  settings.json                    # { "theme": "light", ... }
docs/
  PLAN.md | UI_SPEC.md | API_NOTES.md
```

### Palette ↔ Python bridge

| Direction | Action id | Payload |
|-----------|-----------|---------|
| JS → Python | `pointsChanged` | (selection driven from Python actually) |
| JS → Python | `rowUpdated` | `{ id, text, height, font }` |
| JS → Python | `batchChanged` | `{ enabled, prefix, suffix, start, digits, step }` |
| JS → Python | `optionsChanged` | `{ operation, distance, direction, theme }` |
| JS → Python | `execute` / `cancel` | — |
| Python → JS | `setRows` | `[{ id, text, height, font, pointLabel }]` |
| Python → JS | `setFonts` | `[fontName, …]` |
| Python → JS | `setTheme` | `{ mode, resolved }` |
| Python → JS | `setStatus` | `{ level, message }` |
| Python → JS | `setTargetEnabled` | `bool` |

Selection stays in Python (Fusion selection API); palette is display/edit only for table + options.

### Command pattern

Use a **command that hosts the palette** (or button that shows palette + separate OK that runs a hidden execute command). Recommended:

1. Toolbar button → show palette + arm selection.
2. Palette **OK** → `adsk.fusionSendData('execute')` → Python runs geometry in a proper command execute handler (supports undo).
3. Palette **Cancel** / close → disarm selection, hide palette.

---

## Edge cases & validation

- No points selected → OK disabled + status.
- Cut with no intersection → Fusion error → catch, messageBox / status, leave sketch text or roll back whole transaction (prefer **full rollback**).
- Empty text row → skip or block OK (block).
- Height ≤ 0 → block.
- Mixed components → create features in each point’s native component.
- Sketch not editable / parametrics locked → fail soft with status.
- Batch digits overflow (e.g. start 998, digits 3, 5 rows) → allow wider numbers (no hard fail); zfill is minimum width only.

---

## Implementation phases

### Phase 0 — Scaffold (this PR / next)
- Manifest, empty command, palette shell with light-default CSS matching Fusion.
- Theme switcher wired to CSS `data-theme`.
- Icon placeholders + README for stock vs Photoshop sources.

### Phase 1 — Selection + table
- Multi sketch-point selection → rows.
- Text / height / font columns; font preview on text input.
- Batch prefix/suffix/sequence.

### Phase 2 — Geometry
- `createInput2` + center alignment + rectangle center constraints to point.
- Extrude New Body path end-to-end.

### Phase 3 — Cut + target body
- Body selection input, `participantBodies`, distance/direction.
- Timeline group + undo.

### Phase 4 — Polish
- Auto theme sync, settings persistence, icon finalization, error UX, README install steps.

---

## Testing checklist

- [ ] Light theme default on first launch
- [ ] Dark and Auto follow / override correctly
- [ ] Single point → centered text → New Body extrude
- [ ] Multi-point batch `A-001` … sequence order matches selection
- [ ] Font dropdown preview + text input uses selected face
- [ ] Cut with explicit target body only cuts that body
- [ ] Cut with no target uses Fusion default participation
- [ ] Cancel leaves no new features
- [ ] Undo reverses entire engraving group
- [ ] Works in light and dark Fusion UI chrome

---

## Open decisions (defaults proposed)

| Topic | Proposal |
|-------|----------|
| Join operation | Defer; ship Cut + New Body only |
| Text angle | 0° only in v1; optional angle column later |
| Sketch creation | Always use **existing** sketch of selected point (do not create new sketch) |
| Preview | No live BRep preview in v1 (place on OK); optional ghost text later |
| Default height | `3 mm` |
| Default font | `Arial` |
| Default distance | `1 mm` |
| Default theme | `light` |

---

## Success criteria

1. Stock-like table palette with Fusion icons where possible.
2. Text entity centered and constrained to each selected sketch point.
3. Extrude Cut or New Body with optional target body for Cut.
4. Batch sequential text with prefix/suffix.
5. Font-aware text field + font dropdown.
6. Light / Dark / Auto themes; **Light default**.
