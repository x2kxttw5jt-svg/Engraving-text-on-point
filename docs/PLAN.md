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
Rows appear; pick **orientation vector** per row (or shared); live preview places text
  ↓
Active row: Fusion manipulators — angle edits the **angular dimension**; move if point unconstrained
  ↓
Edit Text / Ht / Font / Flip / Justify / Align / Angle dim (or Batch) → preview updates
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
│  ✛ Ref Pt    [ Select ]  (optional — XY dims from ref to new point)  │
│  ▭ Sketch    [ Select ]  (optional — used by Add Point)              │
│  ↗ Orient    [ Select ]  (vector for text angle — required)          │
│  ⬚ Target Body  [ Select ]     (Cut only)                            │
│  Active row: Angle dim ✓  Move (dims / free) ✓/✗                     │
├──────────────────────────────────────────────────────────────────────┤
│  Operation / Distance / Direction / Live preview                     │
├──────────────────────────────────────────────────────────────────────┤
│  ☐ Batch sequence …                                                  │
├──────────────────────────────────────────────────────────────────────┤
│  # │ Text │ Ht │ Angle │ Orient │ Flip │ Justify │ Align │ Font     │
│  … Angle = driving angular dimension value; Orient = vector ref …  │
├──────────────────────────────────────────────────────────────────────┤
│  Theme  [ Light ▼ ]                     [ Cancel ]  [ OK ]           │
└──────────────────────────────────────────────────────────────────────┘
```

Icon groups use **stock Fusion glyphs** from the Sketch Text dialog family (Flip H/V, Align Left/Center/Right, Align Top/Middle/Bottom) — not custom art.

### Add Point

| Step | Behavior |
|------|----------|
| Click **+ Add Point** | Enter point-placement mode (click in viewport) |
| Optional **Reference point** | User may select a reference point first (sketch point, vertex, construction point, etc.) |
| Sketch already selected | Add `SketchPoint` at the **projected** click location in that sketch |
| No sketch selected | Resolve planar face / construction plane from preselect/click; **create a new sketch** on it (fallback: root `xYConstructionPlane`). Then add the projected point |
| After create | Clear placement CG; if Ref was set → associative project + XY dimensions (below); select new point; add table row; focus manipulators |

Dummy UI: **+ Add Point** / **Ref Point** are mock controls only.

#### Optional reference point + live XY dimensions

Yes — this is supported with normal Fusion sketch associativity:

1. **Select Ref** (optional) before/during Add Point: sketch point, BRep vertex, construction point, or similar.
2. On commit of the new point, **associatively project** the Ref onto the placement sketch (`project2(..., isLinked=True)`). Result is a projected `SketchPoint` in sketch XY.
3. Create **driving** linear dimensions between the **projected Ref** and the **new point** in sketch space:
   - Horizontal: `addDistanceDimension(projRef, newPt, HorizontalDimensionOrientation, …, True)`
   - Vertical: `addDistanceDimension(projRef, newPt, VerticalDimensionOrientation, …, True)`
   - (Optional later: aligned dimension instead of / in addition to H+V.)
4. Those dimension lines are real sketch dimensions. When the new point is transformed:
   - **Preferred:** move manipulator edits the **H/V dimension parameters** (same pattern as angle dim). Dimension lines and values update live; text follows the point via center constraint; extrude updates with the sketch.
   - If Ref source moves, the **linked projection** moves, and the dimensions maintain the offset relationship.
5. With Ref + driving H/V dims, the new point is **no longer freely unconstrained** — move handles drive dim values (do not free-`SketchPoint.move` in a way that fights the dimensions). Without Ref, free move when unconstrained still applies.
6. Hard-fail with reason if Ref cannot be associatively projected or H/V dimensions cannot be created. No unlinked projection fallback.

During placement ghosting, optionally show custom-graphics preview of H/V offset from projected Ref to the ghost point (cosmetic only until commit).

#### Placement preview (custom graphics + preselect)

While in Add Point mode, **do not** create the sketch point until click-commit. Instead:

1. **Preselect** (`Command.preSelect` / `preSelectMouseMove`) tracks the entity under the cursor and the hit point on that entity.
2. **Project** that hit into the target sketch plane (selected sketch, or the plane that would be used if creating a sketch):
   - Prefer projecting onto the sketch X–Y plane (`modelToSketchSpace` + lift back with `sketchToModelSpace`, or plane intersection / `project`-style math).
   - If hovering geometry that can project onto the sketch (edges, vertices, other sketch entities), use that projected location so the ghost snaps to the true placement.
3. **Custom graphics** draw a clear ghost at the projected position:
   - Point marker (billboard circle / crosshair) on the sketch plane
   - Optional short projection guide (line from hit → projected point) when the cursor is off-plane
   - Optional faint sketch-plane hint when creating a new sketch
4. Update graphics every preselect mouse move; **single-flight** replace prior CG group (no leaks).
5. On **click**: create the real `SketchPoint` at the last projected sketch-space coordinate; destroy CG.
6. On **Cancel / Esc / leaving Add Point mode**: destroy all placement CG; no point created.
7. Style: Fusion-like accent (`#0696D7`) or theme-aware custom-graphics color; keep it sparse (marker + optional guide only).

Preselect filtering: allow hits useful for placement (faces, construction planes, sketch curves/points, edges/vertices as project sources). Reject invalid hits (`isSelectable = False`) when they cannot define a projection onto the target plane.

### Orientation vector + angle dimension (no SketchText angle API)

**Fusion has no usable text-placement angle.** `SketchText.angle` / `SketchTextInput.angle` are retired; `setAsMultiLine`’s last argument is character spacing, not rotation. Orientation is done only by constraining the text box (`rectangleLines`).

Our rotation model: a **driving sketch angular dimension** between a text frame edge and an **associatively projected** copy of the user-selected orientation vector. The palette “Angle” column is that dimension’s value — not a text property.

| Item | Behavior |
|------|----------|
| **Orient select** | User picks a direction reference: sketch line, construction axis/line, or linear edge |
| **Associative project** | **Always** project that vector onto the text’s sketch with a **linked/associative** projection (`project2(..., isLinked=True)` or equivalent). The projected line updates if the source vector moves |
| Per-row Orient | Table column / picker; optional “use global Orient for all rows” |
| Missing vector | Angle manipulator + OK blocked for that row; status: `Select orientation vector` |
| Geometry | Driving `addAngularDimension` between a text `rectangleLines` edge and the **projected** orientation line — never dimension directly to the off-sketch source |
| Angle column | Edits that dimension’s parameter; text rotates via the dimension |
| Default | `0 deg` (= parallel to projected vector) |

**Hard-fail with reason** if associative projection cannot be created, the projected entity is not a usable line, or the angular dimension cannot be added. Do not fall back to an unlinked/fixed copy or a numeric-only angle.

### Built-in Fusion transform manipulators

Use Fusion’s **native command-input manipulators** (not a custom triad):

| Handle | Command input | Role |
|--------|---------------|------|
| **Rotation** | `AngleValueCommandInput` + `setManipulator` aligned to the **orientation vector** | Edits the active row’s **angular dimension** value (not a one-shot text rebuild angle) |
| **Translation** | `DistanceValueCommandInput` manipulators in sketch X/Y | Moves the **sketch point** when unconstrained |

**Rules**

1. Manipulators appear at the **active row’s** sketch point. Angle manipulator plane/axes derived from the sketch plane + **orientation vector** (0° along the vector).
2. **Angle manipulator** — enabled when a row is active **and** an orientation vector is set. Dragging updates the driving angular dimension → text rotates via constraints; Angle column syncs to the dimension parameter. **No full text recreate** for angle-only changes once constraints/dimension exist.
3. **Move manipulator** — enabled only if the sketch point is **unconstrained**.
   - If blocked → disable move handles; status: `Move locked — point is constrained (…reason…)`.
   - When unconstrained: move the point; text follows via center constraint; extrude updates with the sketch.
4. Stock Fusion manipulator visuals only.
5. Palette does not draw the triad; the **Command** owns manipulators. Active table row retargets `setManipulator` + which dimension is driven.
6. Move failure → hard status with reason; never drop center or angular constraints.

### Table columns

| Column | Control | Notes |
|--------|---------|--------|
| `#` | Read-only index | Selection order |
| Text | `<input type="text">` | Batch-driven or override; `font-family` = selected font |
| Height | Length input | Default `3 mm` |
| **Angle** | Dimension value (degrees) | Edits driving **angular dimension** vs projected Orient line (not a SketchText angle); default `0` |
| **Orient** | Vector picker / label | Selected orientation vector for that row (or “global”) |
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
- Editing Text / Height / Font / Flip / Justify / Align / Distance / Direction / Operation / Target body updates the preview.
- **Angle** / angle manipulator → update angular **dimension** (text follows constraints; prefer not recreating text).
- **Move** manipulator → move point (text follows center constraint; extrude updates).
- Orient vector change → recreate/repair angular dimension (hard-fail with reason if impossible).
- **Add Point** refreshes preview after commit.
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
| Text / height / font edit | Debounced rebuild (text entity) |
| Angle field / angle manipulator | Update angular **dimension** parameter; no text recreate |
| Orient vector change | Repair dimension to new vector; hard-fail with reason if needed |
| Move manipulator (unconstrained point) | Move point; text follows center constraint; extrude updates |
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
  2. Enter placement mode: arm preselect + allocate a `CustomGraphicsGroup` for the ghost point.
  3. On `preSelectMouseMove`: read hit point/entity → project onto target sketch plane → update custom-graphics marker (and projection guide if needed).
  4. On click commit: if sketch selected → `sketch.sketchPoints.add(projectedSketchPt)`. Else → `sketches.add(plane)` (from preselect plane/face or XY) → add projected point. Clear CG.
  5. Push new point into selection/rows; focus manipulators on it.
  6. Teardown CG on cancel / command destroy / leaving placement mode.

### 2. Centered, angled sketch text

```python
tin = sketch.sketchTexts.createInput2(text, height_cm)
cx, cy = point.geometry.x, point.geometry.y
half_w, half_h = estimate_half_extents(text, height_cm, font)
h_align = horizontal_alignments[justify]
v_align = vertical_alignments[align]
tin.setAsMultiLine(
    adsk.core.Point3D.create(cx - half_w, cy - half_h, 0),
    adsk.core.Point3D.create(cx + half_w, cy + half_h, 0),
    h_align,
    v_align,
    0.0)  # characterSpacing % — orientation comes from constraints/dimension, not retired angle
tin.fontName = font_name
tin.isHorizontalFlip = flip_h
tin.isVerticalFlip = flip_v
sk_text = sketch.sketchTexts.add(tin)
# then: center constraint to point + angular dimension to orientation vector
```

**Orientation + angular dimension (required)**

1. User selects orientation vector (line / axis / edge).
2. **Associatively project** it onto the text sketch: `sketch.project2(vectorEntity, True)` (`isLinked=True`). Keep a reference to the **projected** `SketchLine` (or curve used as the dimension side).
3. From `MultiLineTextDefinition.rectangleLines`, pick the text baseline / orientation edge.
4. `sketch.sketchDimensions.addAngularDimension(textEdge, projectedOrientLine, dimTextPoint, True)` — **driving**.
5. Set initial dimension value to the row Angle (default `0`).
6. Angle column / manipulator write `dimension.parameter` only — text rotates via constraints/dimension.
7. **Never** call retired `SketchText.angle` / `SketchTextInput.angle`, and do not pretend `setAsMultiLine` accepts a placement angle.
8. Hard-fail stages: `orient vector missing`, `associative project failed`, `projected line unavailable`, `angular dimension failed`.

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

- Bound to the driving **angular dimension** vs the Orient vector (not a detached angle property).
- Accept expressions (`"45 deg"`) via the dimension parameter.
- Default `0` (= parallel to orientation vector).
- Field ↔ manipulator ↔ `SketchAngularDimension` parameter stay synchronized.
- After the dimension exists, angle edits should **not** recreate sketch text — only update the dimension (extrude/model updates with the sketch).

**Move manipulator (unconstrained points only)**

- When `isUnconstrained`: show stock move manipulators; apply `SketchPoint.move` / `sketch.move`.
- When constrained: disable move; angle dimension still editable; status explains move lock.
- Never break center or angular constraints to “force” a move.

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
| JS → Python | `orientChanged` | `{ id\|global, entityToken }` |
| JS → Python | `batchChanged` | `{ enabled, prefix, suffix, start, digits, step }` |
| JS → Python | `optionsChanged` | `{ operation, distance, direction, theme, livePreview }` |
| JS → Python | `execute` / `cancel` | — |
| Python → JS | `setRows` | `[{ id, text, height, angle, orientLabel, font, flipH, flipV, justify, align, pointLabel }]` |
| Python → JS | `setFonts` / `setTheme` / `setStatus` / `setTargetEnabled` | … |

Any geometry-affecting message schedules a preview refresh (if live preview on).

### Command pattern

1. Toolbar → start command + show palette + arm selection.
2. Command hosts **hidden/auxiliary** `AngleValueCommandInput` (drives angular dim) + move `DistanceValueCommandInput`(s).
3. Active table row → `setManipulator` at that point using Orient vector axes; enable move only if unconstrained; enable angle only if Orient is set.
4. Angle/move manipulator changes update dimension / point — avoid full text recreate when only those change. Text/font/etc. still go through preview rebuild.
5. OK → `execute` commit + timeline group + hide palette.
6. Cancel / destroy → teardown preview entities; zero leftover **preview** geometry.

---

## Edge cases & validation

- No points → OK disabled; preview empty.
- Empty text / height ≤ 0 → block OK; clear that row’s preview.
- No orientation vector → block angle manipulator + OK for that row; status asks for vector.
- Invalid angle expression → status error; leave last good dimension value.
- Angular dimension / vector projection failure → hard fail with reason.
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
| **+ Add Point** | Appends a fake row; status mentions preselect + custom-graphics projection preview (no CG in dummy) |
| Orient | Fake “Select” sets mock vector label on rows |
| Manipulator status | `Angle dim ✓ (needs Orient)` / `Move ✓` / constrained Move locked |
| Table | Working Text / Ht / Angle / Orient / Flip / Justify / Align / Font |
| Font dropdown | Seeded list; text input `font-family` follows selection |
| Batch | Prefix/suffix/start/digits/step rewrite mock row texts |
| Operation / Distance / Live preview / Theme | Fully interactive; Cut enables Target Body row visually |
| Icons | Stock Fusion PNGs in place (or labeled placeholders until extracted) |
| OK / Cancel | Status only — **no model changes** |
| Bridge | Optional JS↔Python echo; geometry/manipulators no-op |

**Exit criteria for Phase 1:** UI matches `UI_SPEC.md` in light/dark/auto, table + batch + Add Point chrome feel stock, Ryan signs off before Phase 2.

### Phase 2 — Selection + Add Point + Orient + manipulators (no extrude yet)
- Real `SketchPoint` / sketch / orient vector / body selection.
- **Add Point** with preselect + custom-graphics ghost.
- Place text + **center constraint** + **angular dimension to Orient vector**.
- Angle manipulator edits the dimension; Move only if unconstrained.

### Phase 3 — Live preview extrude (New Body)
- Extrude New Body on top of constrained/dimensioned text; cancel teardown; hard-fail with reason.

### Phase 4 — Cut + target body
- `participantBodies`, distance/direction in preview and commit.

### Phase 5 — Polish
- Settings persistence, final icons, error UX, README install, dummy-mode flag removed or gated for dev only.

---

## Testing checklist

- [ ] Light theme default on first launch
- [ ] Dark and Auto follow / override correctly
- [ ] User must select orientation vector before angle is available
- [ ] Angle column + manipulator update the **angular dimension**; text rotates without recreate
- [ ] Orient vector is **associatively projected** onto the text sketch; dimension is to the **projected** line
- [ ] Moving/changing the source orientation vector updates the projected line (linked); text orientation relationship holds
- [ ] Unlinked projection or dimension-to-source (not projected) is not allowed; failures hard-fail with reason
- [ ] Move manipulator enabled only when point unconstrained; text follows center constraint
- [ ] Move manipulator disabled + reason when point constrained
- [ ] Add Point: custom-graphics ghost follows preselect projected location on sketch plane
- [ ] Add Point: projection guide when cursor hit is off-plane
- [ ] Add Point: click commits point at ghost; Esc/cancel clears CG with no point
- [ ] Add Point into selected sketch at projected location
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
| **Text angle API** | **None (retired). Do not use.** |
| **Rotation** | **Orient vector → associative project → driving angular dim to `rectangleLines`; manipulator edits the dim** |
| **Orientation** | **Required vector select → associative project onto text sketch → angular dim to projected line** |
| **Position** | **Stock Fusion move manipulators; only if sketch point is unconstrained** |
| **Add Point** | **Preselect + custom-graphics projected ghost; click commits in selected sketch or new sketch** |
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
2. Text centered and **associatively constrained** to each sketch point; orientation vector **associatively projected** onto the sketch; **driving angular dimension** between text and that projected line; failures **hard-fail with reason**.
3. Extrude Cut or New Body with optional target body for Cut.
4. Batch sequential text with prefix/suffix.
5. Font-aware text field + font dropdown + **angle dim**, **orient vector**, **flip**, **justify**, **align**.
6. **Stock Fusion manipulators**: angle → dimension; move → unconstrained point.
7. **Add Point** with preselect projection preview (custom graphics) into selected or new sketch.
8. **Live preview** with clean cancel/destroy teardown.
9. Light / Dark / Auto themes; **Light default**.

**Cancel vs Add Point:** Preview text/extrudes are always removed on cancel. Points/sketches created via **Add Point** during the session **remain** (user-authored geometry), unless we add an explicit “remove points I added” option later.
