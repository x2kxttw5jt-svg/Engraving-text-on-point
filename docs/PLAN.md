# Engraving Text on Point — Feature Plan

## Goal

A Fusion 360 Python add-in that lets the user pick sketch points, place centered sketch text on each point, then extrude that text as **Cut** or **New Body**, with an optional target body. The UI is a **stock-looking table palette** (light default, dark, auto) that supports per-row text/height/font/**angle**/**flip**/**justify**/**align** and **batch sequential text** with prefix/suffix. Changes show as a **live preview** in the design; Cancel/destroy removes all preview geometry.

---

## User flow

```
Toolbar button → Command starts + Palette opens (+ manipulator command inputs armed)
  ↓
Select existing sketch points  —or—  [Add Point] at a click location
  ↓
Add Point: use selected sketch if any; else create sketch (on picked plane/face or XY) + point
  ↓
Rows appear; live preview places text; active row shows Fusion transform manipulators
  ↓
Manipulator: set angle (always); move point if unconstrained
  ↓
Edit Text / Ht / Font / Flip / Justify / Align / Angle field (or Batch) → preview updates
  ↓
Choose Extrude: Cut | New Body → preview extrude updates
  ↓
If Cut: enable Target Body picker
  ↓
OK → commit + timeline group
Cancel / close → teardown preview; leave user-created Add Point geometry? (see decisions)
```

---

## Palette UI (stock Fusion look)

### Layout

Dockable HTML palette (`adsk.core.Palettes`), width ~460–520px (align/justify columns), height flexible. Horizontal scroll on the table is OK if the dock is narrow.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Engraving Text on Point                                       [?] │
├──────────────────────────────────────────────────────────────────────┤
│  ⊙ Point(s)  [ Select ]  [ + Add Point ]   3 selected                │
│  ▭ Sketch    [ Select ]  (optional — used by Add Point)              │
│  ⬚ Target Body  [ Select ]     (Cut only)                            │
│  Active row manipulators: Angle ✓  Move ✓/✗ (see status)             │
├──────────────────────────────────────────────────────────────────────┤
│  Operation   (•) Cut  ( ) New Body                                   │
│  Distance    [ 1.0 mm ▼ ]                                            │
│  Direction   (•) Positive  ( ) Negative                              │
│  ☑ Live preview                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ☐ Batch sequence …                                                  │
├──────────────────────────────────────────────────────────────────────┤
│  # │ Text │ Ht │ Angle │ Flip │ Justify │ Align │ Font              │
│  … table …                                                           │
├──────────────────────────────────────────────────────────────────────┤
│  Theme  [ Light ▼ ]                     [ Cancel ]  [ OK ]           │
└──────────────────────────────────────────────────────────────────────┘
```

Icon groups use **stock Fusion glyphs** from the Sketch Text dialog family (Flip H/V, Align Left/Center/Right, Align Top/Middle/Bottom) — not custom art.

### Add Point

| Step | Behavior |
|------|----------|
| Click **+ Add Point** | Enter point-placement mode (click in viewport) |
| Sketch already selected | Add `SketchPoint` at the clicked location in that sketch (`modelToSketchSpace` → `sketchPoints.add`) |
| No sketch selected | Prompt/accept a planar face or construction plane click; **create a new sketch** on it (default: root `xYConstructionPlane` if only empty space / no plane pick). Then add the point at the click |
| After create | New point is selected, a table row is added, live preview + manipulators focus that row |

Dummy UI: **+ Add Point** appends a fake row / fake sketch label only.

### Built-in Fusion transform manipulators

Use Fusion’s **native command-input manipulators** (not a custom triad):

| Handle | Command input | Role |
|--------|---------------|------|
| **Rotation** | `AngleValueCommandInput` + `setManipulator(origin, xDir, yDir)` | Sets the active row’s **text angle**; syncs the Angle column |
| **Translation** | `DistanceValueCommandInput` manipulators in sketch X/Y (or equivalent stock move handles) | Moves the **sketch point** when allowed |

**Rules**

1. Manipulators appear at the **active row’s** sketch point (row click / last selected). Origin = point in root/component space; plane = sketch X/Y.
2. **Angle manipulator** — always enabled when a row is active. Dragging updates `angle` → rebuilds preview text; Angle column stays in sync (two-way with the numeric field).
3. **Move manipulator** — enabled only if the sketch point is **unconstrained** (can be moved without violating constraints / fixed-projected geometry).
   - Detect via point constraint state / attempted `SketchPoint.move` / `Sketch.move` probe; if blocked → disable move handles and status:  
     `Move locked — point is constrained (…reason…)`.
   - When unconstrained: dragging moves the point; text follows because it is center-constrained to the point.
4. Prefer stock Fusion manipulator visuals from these command inputs — same look as native Move/Rotate tools.
5. Palette HTML does not draw the triad; the active **Command** owns the manipulators. Selecting a table row tells Python which point gets `setManipulator`.
6. If move fails mid-drag → hard status with reason; do not leave text unconstrained.

### Table columns

| Column | Control | Notes |
|--------|---------|--------|
| `#` | Read-only index | Selection order |
| Text | `<input type="text">` | Batch-driven or override; `font-family` = selected font |
| Height | Length input | Default `3 mm` |
| **Angle** | Angle input (degrees) | Default `0`; per-row |
| **Flip** | Two icon toggles | H + V → `isHorizontalFlip` / `isVerticalFlip`; default off |
| **Justify** | 3-way icon radio | Left / Center / Right → `HorizontalAlignments`; default **Center** |
| **Align** | 3-way icon radio | Top / Middle / Bottom → `VerticalAlignments`; default **Middle** |
| Font | `<select>` | Options styled in that font; drives Text input face |

Optional header “apply to all” for angle / flip / justify / align.

**Justify vs Align (Fusion semantics)**

- **Justify** = horizontal alignment of text **within** the text rectangle (`LeftHorizontalAlignment` / `CenterHorizontalAlignment` / `RightHorizontalAlignment`).
- **Align** = vertical alignment within the rectangle (`TopVerticalAlignment` / `MiddleVerticalAlignment` / `BottomVerticalAlignment`).
- The rectangle **center remains constrained to the sketch point** (associativity unchanged). Changing justify/align reflows glyphs in the box; it does not move the constraint anchor off the point.

### Batch sequence behavior

- Toggle **Batch sequence** on → Text column becomes driven by formula:
  - `display = prefix + str(start + i*step).zfill(digits) + suffix`
  - Example: `PN-` + `001` + `-A` → `PN-001-A`, `PN-002-A`, …
- Changing prefix/suffix/start/digits/step re-writes all non-overridden rows **and refreshes live preview**.
- Per-row “override” flag: user edits Text → that row stops auto-updating until batch is toggled off/on or “Reset batch texts” is clicked.
- Batch does **not** drive Angle, Flip, Justify, or Align (stay per-row unless “apply to all”).
- Iteration order = order points were selected (stable).

### Stock Fusion visual language

- CSS variables matching Fusion palette chrome:
  - Light (default): `#F5F5F5` / `#FFFFFF` surfaces, `#3C3C3C` text, `#0696D7` accent, 1px `#D0D0D0` rules, 2–3px radius (not pill).
  - Dark: `#333333` / `#3C3C3C` surfaces, `#F5F5F5` text, same accent.
- Typography: `Artifakt Element` when available, else Segoe UI / system-ui. **Do not** use Inter/Roboto as brand.
- Controls: flat inputs, thin borders, compact 24–28px row height — no card chrome, no multi-layer shadows, no purple gradients.

### Theme: Light | Dark | Auto

| Mode | Behavior |
|------|----------|
| **Light** (default) | Force light tokens regardless of Fusion theme |
| Dark | Force dark tokens |
| Auto | Follow `activeUserInterfaceTheme`; `prefers-color-scheme` as secondary in the web view |

Persist in `settings.json`. Default `"theme": "light"`.

---

## Live preview

### Requirements

- As soon as ≥1 point is selected and row fields are valid, the viewport shows the engraving result for current options.
- Editing Text / Height / Font / Angle / Flip / Justify / Align / Distance / Direction / Operation / Target body updates the preview.
- Manipulator angle/move and **Add Point** also refresh preview (move is immediate).
- **Cancel**, palette close, command destroy, or un-selecting a point **deletes** that row’s preview entities. Nothing left in the timeline or sketches from cancelled sessions.
- OK commits a clean final result (see Commit strategy).

### Architecture

Host a Fusion **Command** for the session (palette is the UI). Preview runs through the command’s **`executePreview`** path so Fusion handles rollback of preview features between ticks.

```
Palette change / selection change
  → debounce (~120–200 ms for text typing; immediate for point add/remove)
  → mark command inputs dirty / fire preview
  → executePreview:
        destroy prior preview set for this command tick (Fusion rolls back)
        for each row: create sketch text (centered, angled) + constraints
        for each row: extrude Cut | New Body (participantBodies if Cut)
  → execute (OK):
        same builder with commit=True (or accept last preview — prefer explicit rebuild)
  → destroy / cancel:
        no commit; all preview geometry gone
```

### Cadence / performance rules

| Event | Preview action |
|-------|----------------|
| Command created / palette shown | Warm font list, unit prefs, empty preview |
| Point added / removed / Add Point | Rebuild preview for affected rows (full set OK for modest N) |
| Text / height / font / angle edit | Debounced rebuild |
| Angle manipulator drag | Rebuild on input changed (Fusion cadence) |
| Move manipulator (unconstrained point) | Move point; text follows constraints; light preview refresh |
| Flip H / V toggle | Immediate rebuild (cheap boolean) |
| Justify / Align change | Immediate rebuild |
| Distance / direction / operation / target | Rebuild extrude portion (full rebuild OK v1) |
| Theme-only change | **No** geometry rebuild |
| Mouse move during point pick (hover) | **No** rebuild — only on selection accept |

Do **not** call heavy ensure/compute paths from hover handlers. Keep a single `PreviewSession` object holding row → entity tokens; clear on cancel/destroy.

### Preview vs final

- Preview and final use the **same builder** (`lib/text_on_point.py` + `lib/extrude_text.py`) with a `preview: bool` flag only for naming (`_Preview` suffix on features/sketches if needed) and for skipping timeline group until commit.
- Prefer creating text in the **existing sketch** of each point for both preview and final so constraints stay associative.
- Cut preview may be expensive; if Cut preview fails (no intersection yet), show sketch text only + status “Cut preview pending — adjust distance/target”.

### Live preview toggle

Checkbox **Live preview** (default **on**). When off: no geometry until OK (still validates inputs). Persist in `settings.json` as `"livePreview": true`.

---

## Icons

Prefer built-in Fusion glyphs; else Photoshop 16/32/64 PNGs (see `resources/icons/README.md`).

| Action | Preferred stock | Fallback |
|--------|-----------------|----------|
| Command | Extrude / Text | Point + “T”, Fusion blue |
| Point select | SketchPoint | Crosshair |
| Body select | BRep body | Body silhouette |
| Cut / New Body | Extrude Cut / New Body | Cutter / plus+body |
| **Flip Horizontal** | **Stock Fusion Flip Horizontal** (Sketch Text family) | Photoshop retouch of stock only |
| **Flip Vertical** | **Stock Fusion Flip Vertical** | Same |
| **Justify L/C/R** | **Stock Fusion text align left / center / right** | Same |
| **Align T/M/B** | **Stock Fusion text align top / middle / bottom** | Same |

Ship under `resources/icons/flipH|flipV|justifyLeft|justifyCenter|justifyRight|alignTop|alignMiddle|alignBottom/` (16×16; light/dark if available). Record Fusion install source paths in `resources/icons/README.md`.

---

## Geometry & API design

### 1. Point selection + Add Point

- Multi-select `SketchPoint`; each → row + tokens `{ sketchEntityToken, pointEntityToken, component, isUnconstrained }`.
- Allow multi-sketch; process per parent sketch under one timeline group on commit.
- **Add Point** flow:
  1. Optional sketch selection input (`Sketches` filter).
  2. Click placement: if sketch selected → `pt = sketch.modelToSketchSpace(clickModelPt)` → `sketch.sketchPoints.add(pt)`.
  3. Else → resolve planar entity from click (face / construction plane); `sketches.add(plane)`; then add point. Fallback plane: `rootComp.xYConstructionPlane`.
  4. Push new point into selection/rows; focus manipulators on it.

### 2. Centered, angled sketch text

```python
tin = sketch.sketchTexts.createInput2(text, height_cm)
cx, cy = point.geometry.x, point.geometry.y
half_w, half_h = estimate_half_extents(text, height_cm, font)
h_align = horizontal_alignments[justify]   # left|center|right
v_align = vertical_alignments[align]       # top|middle|bottom
# 5th arg is characterSpacing on current API; set angle via supported angle property/path (see API_NOTES)
tin.setAsMultiLine(
    adsk.core.Point3D.create(cx - half_w, cy - half_h, 0),
    adsk.core.Point3D.create(cx + half_w, cy + half_h, 0),
    h_align,
    v_align,
    0.0)  # characterSpacing %
tin.fontName = font_name
tin.isHorizontalFlip = flip_h
tin.isVerticalFlip = flip_v
# apply angle_deg via the current Fusion angle API for multiline text
sk_text = sketch.sketchTexts.add(tin)
```

**Justify + Align columns**

- Two exclusive icon groups per row (radio behavior): Justify L/C/R, Align T/M/B.
- Stock Fusion SketchText alignment icons; pressed state on the active choice.
- Defaults: **Center** + **Middle** (matches center-on-point framing).
- Maps to `adsk.core.HorizontalAlignments` / `VerticalAlignments` in `setAsMultiLine`.
- Live preview updates immediately; center constraint to the sketch point remains mandatory after rebuild.

**Flip column**

- Two per-row toggle buttons with **stock Fusion flip icons** (horizontal / vertical).
- Active (pressed) state when that flip is on — match Fusion toolbar toggle chrome (accent border or depressed fill).
- Tooltips: `Flip Horizontal`, `Flip Vertical`.
- API: `SketchTextInput.isHorizontalFlip` / `isVerticalFlip` (also on `SketchText` after create).
- Defaults: both `false`. Center constraints still required after flip; flip must not break associativity — if constraints fail after flip rebuild, hard-fail with reason.
- Live preview updates immediately on toggle.

**Angle column + angle manipulator**

- Store degrees in the palette; convert to radians for API.
- Accept expressions when possible (`"45 deg"`, `"0.785 rad"`) via `unitsManager`.
- Default `0`. Range unrestricted in v1 (normalize display to −180…180 optional).
- Changing angle (field **or** `AngleValueCommandInput` manipulator) updates text rotation on rebuild; constraints keep center on the point (rotate about center).
- Field ↔ manipulator stay synchronized.

**Move manipulator (unconstrained points only)**

- When `isUnconstrained`: show stock distance/move manipulators; apply `SketchPoint.move` / `sketch.move` in sketch space.
- When constrained: hide/disable move manipulators; angle still works; status explains why move is locked.
- Never break the text↔point center constraint to “force” a move.

**Center constraint (required — hard fail)**

After add, use `MultiLineTextDefinition.rectangleLines`:

1. Keep the four rectangle lines from the definition.
2. Mid-point / coincident constraints so rectangle center stays on the selected `SketchPoint`.
3. **No soft fallback.** If `rectangleLines` is missing, constraint creation throws, or the center is not associatively tied to the point → **hard fail** that row (and abort the whole OK transaction). Roll back any geometry created for that attempt. **Always report why** it failed (see Error reporting below). Preview: drop that rebuild and surface the error; do not leave unconstrained text in the sketch.

**Error reporting (constraint failures)**

Surface a concrete reason — not only “Failed to constrain text to point”. Include:

| Field | Example |
|-------|---------|
| Row / point | `Row 2` / sketch point name or index |
| Stage | e.g. `rectangleLines unavailable`, `midPoint constraint`, `coincident to sketch point`, `verify associativity` |
| API / exception detail | Fusion `RuntimeError` / return code / message when present |
| Hint (optional) | Short next step if known (`Sketch locked`, `Point from different sketch`, …) |

Formats:

- Palette status (preview):  
  `Constraint failed — Row 2: rectangleLines unavailable (MultiLineTextDefinition returned empty).`
- OK `messageBox` / log: same text, plus full traceback in Text Commands / add-in log when an exception was thrown.

Raise a dedicated error type (e.g. `TextConstraintError(stage, detail, row_id)`) from `text_on_point.py` so preview and execute share one message path.

### 3. Extrude

```python
ext_in = extrudes.createInput(
    sk_text,
    adsk.fusion.FeatureOperations.CutFeatureOperation  # or NewBodyFeatureOperation
)
ext_in.setDistanceExtent(False, adsk.core.ValueInput.createByReal(dist_cm))
if op == Cut and target_bodies:
    ext_in.participantBodies = target_bodies
extrudes.add(ext_in)
```

| Operation | FeatureOperations | Target body |
|-----------|-------------------|-------------|
| Cut | `CutFeatureOperation` | Optional `participantBodies` |
| New Body | `NewBodyFeatureOperation` | Hidden |

Commit: one timeline group **Engraving Text on Point**.

### 4. Fonts

Discover + seed common set; invalid → `Arial` + status toast.

### 5. Units

Internal cm / radians. Palette shows design length units and degrees for angle.

---

## Architecture

```
EngravingTextOnPoint/
  EngravingTextOnPoint.py
  EngravingTextOnPoint.manifest
  commands/
    engraving_text_command.py      # created / preview / execute / destroy
    selection_handlers.py
  lib/
    text_on_point.py               # create text + angle + center constraints
    extrude_text.py
    preview_session.py             # preview cadence, teardown, debounce keys
    batch_sequence.py
    fonts.py
    settings.py
    fusion_util.py
  resources/palette/…  resources/icons/…
  settings.json
docs/
  PLAN.md | UI_SPEC.md | API_NOTES.md
```

### Palette ↔ Python bridge

| Direction | Action | Payload |
|-----------|--------|---------|
| JS → Python | `rowUpdated` | `{ id, text, height, angle, font, flipH, flipV, justify, align }` |
| JS → Python | `batchChanged` | `{ enabled, prefix, suffix, start, digits, step }` |
| JS → Python | `optionsChanged` | `{ operation, distance, direction, theme, livePreview }` |
| JS → Python | `execute` / `cancel` | — |
| Python → JS | `setRows` | `[{ id, text, height, angle, font, flipH, flipV, justify, align, pointLabel }]` |
| Python → JS | `setFonts` / `setTheme` / `setStatus` / `setTargetEnabled` | … |

Any geometry-affecting message schedules a preview refresh (if live preview on).

### Command pattern

1. Toolbar → start command + show palette + arm selection.
2. Command hosts **hidden/auxiliary** `AngleValueCommandInput` + move `DistanceValueCommandInput`(s) so Fusion draws stock manipulators in the viewport.
3. Active table row → `setManipulator` at that point; enable move only if unconstrained.
4. Selection / palette / manipulator changes → `executePreview` rebuild (or point move + light refresh).
5. OK → `execute` commit + timeline group + hide palette.
6. Cancel / destroy → teardown preview entities; zero leftover **preview** geometry.

---

## Edge cases & validation

- No points → OK disabled; preview empty.
- Empty text / height ≤ 0 → block OK; clear that row’s preview.
- Invalid angle expression → status error; keep last good preview.
- **Center constraint failure → hard fail** (no unconstrained placement). Preview/OK show **why** (stage + API detail + row); OK aborts and rolls back the full transaction.
- Cut with no intersection → text-only preview + warning; OK still attempts and rolls back on hard failure.
- Mixed components → features in each point’s component.
- Live preview off → OK builds everything in `execute` only.
- Debounce: rapid typing must not stack overlapping builds (single-flight flag in `PreviewSession`).

---

## Implementation strategy

**Build a complete dummy UI first, then wire Fusion geometry.**  
Do not start sketch-text / extrude / constraint code until the palette looks and behaves like the final product with mock data. Review and iterate on layout, icons, theme, and table interactions in the dummy before binding real selection and preview.

---

## Implementation phases

### Phase 0 — Scaffold (done)
- Manifest, palette shell columns, light-default CSS, settings stubs.
- Docs for full behavior (geometry, constraints, preview).

### Phase 1 — Dummy UI (**next / current build focus**)
Fully interactive mock palette that can be opened from the add-in **without** creating sketch text or extrudes.

| Area | Dummy behavior |
|------|----------------|
| Open palette | Toolbar command shows docked palette only |
| Point(s) / Sketch / Target Body | Buttons add/remove **fake rows** / fake sketch/body labels |
| **+ Add Point** | Appends a fake row; status `Would add point to sketch…` |
| Manipulator status | Mock line: `Angle ✓  Move ✓` / toggle a demo “constrained” row that shows Move locked |
| Table | Working Text / Ht / Angle / Flip / Justify / Align / Font controls |
| Font dropdown | Seeded list; text input `font-family` follows selection |
| Batch | Prefix/suffix/start/digits/step rewrite mock row texts |
| Operation / Distance / Live preview / Theme | Fully interactive; Cut enables Target Body row visually |
| Icons | Stock Fusion PNGs in place (or labeled placeholders until extracted) |
| OK / Cancel | Status only — **no model changes** |
| Bridge | Optional JS↔Python echo; geometry/manipulators no-op |

**Exit criteria for Phase 1:** UI matches `UI_SPEC.md` in light/dark/auto, table + batch + Add Point chrome feel stock, Ryan signs off before Phase 2.

### Phase 2 — Selection + Add Point + manipulators (no extrude yet)
- Real `SketchPoint` / sketch / body selection.
- **Add Point** creates sketch if needed + point at click.
- Wire stock **Angle** + **Move** manipulators; move only if unconstrained; sync Angle column.
- Optional: show preview text without extrude for placement feedback.

### Phase 3 — Geometry + live preview (New Body)
- Full builder: text + angle + flip + justify + align + center constraints + extrude New Body.
- `PreviewSession` + `executePreview`; cancel teardown; hard-fail constraints with reason.

### Phase 4 — Cut + target body
- `participantBodies`, distance/direction in preview and commit.

### Phase 5 — Polish
- Settings persistence, final icons, error UX, README install, dummy-mode flag removed or gated for dev only.

---

## Testing checklist

- [ ] Light theme default on first launch
- [ ] Dark and Auto follow / override correctly
- [ ] Angle column and **angle manipulator** stay in sync; rotate about point center
- [ ] Move manipulator enabled only when point unconstrained; moves point; text follows
- [ ] Move manipulator disabled + reason when point constrained
- [ ] Add Point into selected sketch at click location
- [ ] Add Point with no sketch selected creates sketch (plane/XY) then point
- [ ] Flip H / Flip V toggles use stock Fusion icons; preview and commit match
- [ ] Justify L/C/R and Align T/M/B use stock Fusion icons; preview and commit match
- [ ] Non-center justify/align still keeps rectangle center constrained to the point
- [ ] Flip + angle + align together; center constraint still holds (point drag moves text)
- [ ] Moving the sketch point after OK moves the text (constraints hold)
- [ ] Simulated / real constraint failure → hard fail, no leftover unconstrained text, status/message includes failure reason (stage + detail)
- [ ] Live preview updates on text/height/font/angle/distance edits (debounced)
- [ ] Cancel / close leaves no sketch text or extrudes
- [ ] Live preview off → no geometry until OK
- [ ] Single point → centered text → New Body
- [ ] Multi-point batch sequence order matches selection
- [ ] Font dropdown + text input face
- [ ] Cut with / without explicit target body
- [ ] Undo reverses entire engraving group after OK

---

## Decisions

| Topic | Decision |
|-------|----------|
| Join operation | Defer; Cut + New Body only |
| **Text angle** | **Angle column + stock Fusion angle manipulator; default 0** |
| **Position** | **Stock Fusion move manipulators; only if sketch point is unconstrained** |
| **Add Point** | **Button: point at click in selected sketch; else create sketch then point** |
| **Text flip** | **Per-row H + V toggles; stock Fusion flip icons; default off** |
| **Justify / Align** | **Per-row H (L/C/R) + V (T/M/B); stock Fusion align icons; default Center / Middle** |
| Sketch creation | Use existing sketch of selected/Add Point target; create only when Add Point has no sketch |
| **Preview** | **Live preview on by default via executePreview; teardown on cancel** |
| Default height | `3 mm` |
| Default font | `Arial` |
| Default distance | `1 mm` |
| Default angle | `0 deg` |
| Default flip H/V | `false` / `false` |
| Default justify / align | `center` / `middle` |
| Default theme | `light` |

---

## Success criteria

1. Stock-like table palette with Fusion icons where possible.
2. Text centered and **associatively constrained** to each selected sketch point, at the row’s angle; constraint failure is a **hard fail** that **reports why** (no unconstrained fallback).
3. Extrude Cut or New Body with optional target body for Cut.
4. Batch sequential text with prefix/suffix.
5. Font-aware text field + font dropdown + **angle**, **flip**, **justify**, and **align** (stock Fusion icons).
6. **Stock Fusion transform manipulators** for angle + unconstrained point move.
7. **Add Point** into selected sketch or newly created sketch.
8. **Live preview** with clean cancel/destroy teardown.
9. Light / Dark / Auto themes; **Light default**.

**Cancel vs Add Point:** Preview text/extrudes are always removed on cancel. Points/sketches created via **Add Point** during the session **remain** (user-authored geometry), unless we add an explicit “remove points I added” option later.
