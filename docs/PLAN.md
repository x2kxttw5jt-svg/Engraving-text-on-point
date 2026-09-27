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
│  ✛ Ref Pt    [ Select ]  [ Apply Ref Dims ]  (new or existing free pts) │
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
| Optional **Reference point** | Select Ref (sketch point, vertex, construction point, …) for XY dims |
| Sketch already selected | Add `SketchPoint` at the **projected** click location in that sketch |
| No sketch selected | Resolve planar face / construction plane from preselect/click; **create a new sketch** on it (fallback: root `xYConstructionPlane`). Then add the projected point |
| After create | Clear placement CG; if Ref was set → apply Ref dims (below); select new point; add table row; focus manipulators |

Dummy UI: **+ Add Point** / **Ref Point** / **Apply Ref Dims** are mock controls only.

#### Standalone reusable module: sketch transform frame (`sketch_transform_frame`)

Ref point + live dimensions + manipulators (including **angle**) are **not** engraving-specific. Build them as a **standalone reusable package** other Fusion add-ins can copy/import.

**Package layout** (ship beside the add-in; no engraving imports inside):

```
sketch_transform_frame/           # reusable — no dependency on EngravingTextOnPoint
  __init__.py                     # public API re-exports
  project.py                      # associative project2 helpers
  apply_frame.py                  # apply Ref H/V + Orient angular dims to a target point
  drag_cadence.py                 # driven-during-drag / restore-driving
  manipulators.py                 # wire AngleValue + DistanceValue command inputs
  visibility.py                   # keep dims visible (preview + drag)
  errors.py                       # staged hard-fail errors with reasons
  README.md                       # how to reuse in another add-in
```

**Public API (conceptual):**

```python
frame = TransformFrame.apply(
    sketch,
    target_point,              # new or existing unconstrained SketchPoint
    ref_point_entity=None,     # optional → associative project + H/V dims
    orient_vector_entity=None, # optional/required by caller → associative project + angular dim
    angle_entity=None,         # optional SketchLine/text edge to dimension against Orient
    angle_value="0 deg",
)
frame.ensure_visible(sketch)
frame.begin_translate_drag()   # H/V (+ angle if included in translate set) → driven
frame.end_translate_drag()     # write values → driving
frame.begin_rotate_drag()      # angular dim → driven during rotate (same lag avoidance)
frame.end_rotate_drag()
frame.bind_manipulators(angle_input, dist_x_input, dist_y_input)
```

This engraving add-in **calls** the module; it does not reimplement projection/dim/drag logic inline.

#### Optional Ref + Orient dimensions (via the module)

Works for **both**:

| Target | When |
|--------|------|
| **New point** (Add Point) | If Ref and/or Orient set at commit → `TransformFrame.apply(...)` |
| **Existing unconstrained point** | Active free point → Apply Ref Dims / Orient → same `TransformFrame.apply` |

Pipeline (inside `apply_frame.py`):

1. **Ref** (optional): associatively project onto sketch → driving **H + V** `addDistanceDimension(projRef, targetPt, …)`.
2. **Orient** (when provided): associatively project vector → driving **angular** `addAngularDimension(angleEntity, projOrientLine, …)`.  
   - For engraving, `angleEntity` = text `rectangleLines` baseline edge.  
   - For reuse, caller passes any sketch line/edge that should be angled to the projected vector.
3. **Visibility (required during preview):** all frame dims (H, V, **and angle**) stay **visible** for the live-preview session — including while temporarily driven during drag. `areDimensionsShown`; re-assert after rebuilds.
4. **Transform:** driven-during-drag for translate (H/V) and rotate (angle); restore driving on stop; graphics stay on-screen.
5. Without Ref, free move when unconstrained still applies. Without Orient, angle manipulator stays disabled.
6. Hard-fail with reason on project/dim failure; no unlinked projection fallback.
7. One frame instance per target point/row (replace/repair on re-apply).

During Add Point ghosting, optional CG preview of H/V offsets from projected Ref (cosmetic until commit).

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

### Orientation / angle (part of `sketch_transform_frame`)

**Fusion has no usable text-placement angle.** `SketchText.angle` / `SketchTextInput.angle` are retired; `setAsMultiLine`’s last argument is character spacing, not rotation.

Angle is handled **inside the reusable transform-frame module** the same way as Ref H/V dims:

| Item | Behavior |
|------|----------|
| **Orient select** | User picks a direction reference: sketch line, construction axis/line, or linear edge |
| **Associative project** | Module always `project2(..., linked=True)` onto the target sketch |
| **Angular dimension** | Module creates driving `addAngularDimension` between caller-supplied angle entity (engraving: text `rectangleLines` edge) and the **projected** orient line |
| Angle column / manipulator | Read/write that dimension parameter via `TransformFrame` — not a SketchText property |
| Visibility | Angle dim visible during preview + rotate drag (driven/driving), same rules as Ref H/V |
| Drag cadence | Rotate gesture: angular dim → driven during drag → driving on stop (lag avoidance) |
| Default | `0 deg` (= parallel to projected vector) |

Missing Orient → angle manipulator + OK blocked for engraving rows that require it. Hard-fail with reason on project/dim failure.

### Built-in Fusion transform manipulators

Use Fusion’s **native command-input manipulators** (not a custom triad):

| Handle | Command input | Role |
|--------|---------------|------|
| **Rotation** | `AngleValueCommandInput` + `setManipulator` aligned to the **orientation vector** | Edits the active row’s **angular dimension** value (not a one-shot text rebuild angle) |
| **Translation** | `DistanceValueCommandInput` manipulators in sketch X/Y | Edits **H/V dims to Ref** when present; else free-moves the point when unconstrained |

**Rules**

1. Manipulators appear at the **active row’s** sketch point. Angle manipulator plane/axes derived from the sketch plane + **orientation vector** (0° along the vector).
2. **Angle manipulator** — enabled when a row is active **and** an orientation vector is set. Dragging updates the driving angular dimension → text rotates via constraints; Angle column syncs to the dimension parameter. **No full text recreate** for angle-only changes once constraints/dimension exist.
3. **Move manipulator**
   - **With optional Ref + H/V dims:** translate the point; keep dimension **lines** visible/updating. Use the **driven-during-drag** cadence below so the solver stays light.
   - **Without Ref:** enabled only if the sketch point is freely **unconstrained**; otherwise status `Move locked — point is constrained (…reason…)`.
   - Never permanently drop center constraint, Orient angular dim, or Ref H/V dims.
4. Stock Fusion manipulator visuals only.
5. Palette does not draw the triad; the **Command** owns manipulators. Active table row retargets `setManipulator` + which dimension is driven.
6. Move failure → hard status with reason; restore any temporarily driven dims to driving on abort when possible.

#### Drag cadence (avoid lag) — driven ↔ driving (`drag_cadence.py`)

Implemented once in the reusable module; engraving only calls it.

| Gesture | Dims toggled to driven during drag | On stop |
|---------|--------------------------------------|---------|
| **Translate** | Ref **H + V** (angle stays driving unless it blocks the move) | Write H/V values → driving; keep **all frame dims visible** |
| **Rotate** | **Angular** dim (H/V stay driving unless they block) | Write angle value → driving; keep visible |

| Phase | Action |
|-------|--------|
| **Drag start** | `isDriving = False` on the affected frame dims; visibility stays on |
| **During drag** | Move/rotate via manipulators; driven dims measure with visible lines/values; throttle heavy extrude preview |
| **Drag end** | Set parameters from measured pose → `isDriving = True`; one final solve; sync UI |
| **Cancel / error** | Best-effort restore driving at last good values; hard-fail with reason if restore fails |

Do **not** leave frame dims driven after the gesture. Do not toggle unrelated sketch dims. Driven/driving swaps must **not** hide dimension graphics.

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
- **Transform-frame dimensions (Ref H/V and Orient angle, when applied) are visible for the whole live-preview session** — not only after OK. Same for drag (driven) and idle (driving).
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
| Move manipulator (no Ref dims) | Move point; text follows center constraint; throttle extrude refresh |
| Move manipulator (with Ref H/V dims) | Dims → driven on drag start; move point; dims → driving on drag end |
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
  1. Optional sketch selection; optional **Ref point** selection.
  2. Enter placement mode: arm preselect + CG ghost (+ optional Ref offset guides).
  3. On `preSelectMouseMove`: hit → project onto target sketch plane → update CG ghost.
  4. On click commit: create sketch if needed → `sketch.sketchPoints.add(projectedSketchPt)`. Clear CG.
  5. If Ref set: run **apply_ref_dims(targetPt)** (below).
  6. Push new point into rows; focus manipulators.
  7. Teardown CG on cancel / destroy / leaving placement mode.

- **Transform frame** (via `sketch_transform_frame.TransformFrame.apply`):
  1. Target = new Add Point result or existing unconstrained sketch point.
  2. Optional Ref → associative project + driving H/V dims.
  3. Optional Orient + angle entity (text edge) → associative project + driving angular dim.
  4. `ensure_visible`; bind manipulators; store `TransformFrame` on the row.

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

**Orientation + angular dimension (via reusable frame)**

1. User selects orientation vector; create sketch text + center constraints first.
2. Pick text baseline edge from `rectangleLines`.
3. Call `TransformFrame.apply(..., orient_vector_entity=orient, angle_entity=textEdge, angle_value=…)`.
4. Angle column / manipulator go through the frame (dimension parameter only).
5. **Never** call retired `SketchText.angle` / `SketchTextInput.angle`.
6. Hard-fail stages come from the frame: `orient vector missing`, `associative project failed`, `projected line unavailable`, `angular dimension failed`.

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

**Move manipulator**

- **No Ref dims / unconstrained:** stock move manipulators; `SketchPoint.move` / `sketch.move`.
- **With Ref H/V dims:** use **driven-during-drag → driving-on-stop** (see Translate cadence). Do not edit driving parameters every tick.
- Other locks: disable move; status explains why.
- Never permanently break center or angular constraints to force a move.

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
    text_on_point.py               # create text + center constraints; calls transform frame for Orient angle
    extrude_text.py
    preview_session.py
    batch_sequence.py
    fonts.py
    settings.py
    fusion_util.py
  sketch_transform_frame/          # STANDALONE reusable package (see section above)
    … project, apply_frame, drag_cadence, manipulators, visibility, errors, README
  resources/palette/…  resources/icons/…
  settings.json
docs/
  PLAN.md | UI_SPEC.md | API_NOTES.md
```

Engraving code may depend on `sketch_transform_frame`. The frame package must **not** import engraving modules.

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
| **+ Add Point** | Appends a fake row; status mentions preselect + CG projection preview |
| **Ref Pt** / **Apply Ref Dims** | Fake select + apply on mock unconstrained row or next Add Point |
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

### Phase 2 — `sketch_transform_frame` + selection + Add Point (no extrude yet)
- Implement standalone **`sketch_transform_frame`** (Ref H/V + Orient angle + visibility + drag cadence + manipulators) with its own README.
- Wire engraving to the frame; no duplicated project/dim logic in engraving modules.
- Real selection + Add Point CG ghost; text + center constraint; frame applies Orient angle (+ optional Ref).
- Manipulators via `frame.bind_manipulators`.

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
- [ ] Optional Ref on **Add Point**: associative project + driving H/V dims to new point
- [ ] Optional Ref on **existing unconstrained** point: same apply_ref_dims path
- [ ] Existing constrained point + Ref → hard-fail with reason (no dims)
- [ ] Move with Ref: dims switch to driven during drag and back to driving on stop; final values match pose
- [ ] Move with Ref stays responsive (no per-tick driving solve); dimension lines still update as driven measures
- [ ] Ref H/V **and angle** dims visible throughout live preview (idle, drag, after rebuilds)
- [ ] Cancel/error mid-drag restores driving dims when possible
- [ ] Ref/Orient source moves update linked projections; dimensional relationships hold
- [ ] `sketch_transform_frame` has no imports from engraving modules; README documents reuse
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
| **Transform frame** | **Standalone reusable `sketch_transform_frame`: Ref H/V + Orient angle + manipulators + driven-during-drag + preview visibility** |
| **Add Point** | **Preselect + CG ghost; optional Ref/Orient applied via TransformFrame on commit** |
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
6. **Reusable `sketch_transform_frame`** owns Ref H/V + angle dims, visibility, manipulators, drag cadence.
7. **Add Point** with preselect CG ghost; frame applies to new **or existing unconstrained** points.
8. **Live preview** with clean cancel/destroy teardown.
9. Light / Dark / Auto themes; **Light default**.

**Cancel vs Add Point:** Preview text/extrudes are always removed on cancel. Points/sketches created via **Add Point** during the session **remain** (user-authored geometry), unless we add an explicit “remove points I added” option later.
