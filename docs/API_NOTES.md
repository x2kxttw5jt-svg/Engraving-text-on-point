# API Notes — Fusion 360

Target: current Fusion production API (2024+ multiline text). Python add-in.

## Sketch text

| Prefer | Avoid |
|--------|--------|
| `SketchTexts.createInput2(text, height)` + `setAsMultiLine(...)` | Retired `createInput(text, height, point)` for new work |
| `SketchText.heightParameter` (expression / value) | Retired `SketchText.height` |
| `SketchText.definition` → `MultiLineTextDefinition.rectangleLines` | Retired `SketchText.boundaryLines` |

**Height edits:** write `heightParameter` from the palette Ht column **or** triad **unified scale** (`unifiedScaleFactor` × height at gesture start). Never geometrically scale the text rectangle via `sketch.move`.

Center alignment:

```python
HorizontalAlignments.CenterHorizontalAlignment
VerticalAlignments.MiddleVerticalAlignment
```

Constraint strategy: after `add`, constrain rectangle center to selected `SketchPoint` via mid-point / coincident constraints on `rectangleLines`.

**Hard fail if constraints cannot be applied** — do not leave text positioned only by coordinates. Delete/roll back the attempted text (and any dependent preview extrude), raise/return an error to the command, and surface it in the palette status (and messageBox on OK). Associativity with the sketch point is mandatory so moving the point moves the text.

**Always include the failure reason in the user-visible message.** Wrap each constraint step and classify failures, for example:

```python
class TextConstraintError(RuntimeError):
    def __init__(self, stage: str, detail: str, row_id=None):
        self.stage = stage
        self.detail = detail
        self.row_id = row_id
        where = f"Row {row_id}: " if row_id is not None else ""
        super().__init__(f"Constraint failed — {where}{stage} ({detail})")

# stages to emit explicitly:
# - "rectangleLines unavailable"
# - "midPoint constraint"
# - "coincident to sketch point"
# - "verify associativity"
# - "associative project failed"
# - "projected line unavailable"
# - "angular dimension failed"
# detail = str(exception) or a precise local check message
```

Do not swallow Fusion exceptions into a generic toast; chain `detail` from the original error.

### Justify + Align

`setAsMultiLine(corner, diagonal, horizontalAlignment, verticalAlignment, characterSpacing)`:

| UI Justify | `HorizontalAlignments` |
|------------|------------------------|
| Left | `LeftHorizontalAlignment` |
| Center (default) | `CenterHorizontalAlignment` |
| Right | `RightHorizontalAlignment` |

| UI Align | `VerticalAlignments` |
|----------|----------------------|
| Top | `TopVerticalAlignment` |
| Middle (default) | `MiddleVerticalAlignment` |
| Bottom | `BottomVerticalAlignment` |

These control text placement **inside** the text rectangle. The rectangle center stays constrained to the sketch point.

### There is no text placement angle API

`SketchText.angle` and `SketchTextInput.angle` are **retired** (Jan 2021). `setAsMultiLine` does **not** take a rotation angle — its 5th argument is **characterSpacing** (%).

Autodesk’s guidance for multiline text: control orientation by constraining / transforming `MultiLineTextDefinition.rectangleLines` (the four box edges). `MultiLineTextDefinition.rotate` is a one-shot box rotate, **not** a parametric angle — we do **not** use it for user angle edits.

**Our approach (parametric):** associatively project the Orient vector → driving `addAngularDimension` between a text `rectangleLines` edge and that projected line. The palette “Angle” field is that **dimension parameter**, not a SketchText property.

```text
❌ sketchText.angle = …
❌ sketchTextInput.angle = …
❌ treat setAsMultiLine(..., angle) as rotation
✅ project2(orient, linked=True) + addAngularDimension(textEdge, projectedLine, …)
✅ angle UI / manipulator → dimension.parameter
```

### Orientation = associative project + driving angular dimension

**Always** associatively project the selected orientation vector onto the text sketch, then dimension the text to that **projected** line:

```python
# 1) Associative (linked) projection onto the text sketch — required
#    project2(entity, isLinked=True)  — verify arg name on target Fusion build
proj_entities = sketch.project2(selected_vector_entity, True)
projected_line = as_sketch_line(proj_entities)  # must be usable SketchLine

# 2) Text frame edge from MultiLineTextDefinition.rectangleLines
text_edge = pick_baseline_edge(sk_text.definition.rectangleLines)

# 3) Driving angular dimension: text edge ↔ projected line (not the source entity)
dim = sketch.sketchDimensions.addAngularDimension(
    text_edge, projected_line, dim_text_point, True)
dim.parameter.expression = "0 deg"  # or row angle

# 4) Angle manipulator / Angle column → update dim.parameter only
```

Rules:

- Dimension **only** against the projected line, never against the off-sketch source.
- Projection must be **linked/associative** so source edits update the sketch reference.
- Do not use an unlinked/fixed projection as a fallback.
- Hard-fail stages: `orient vector missing`, `associative project failed`, `projected line unavailable`, `angular dimension failed`.

### Flip

```python
tin.isHorizontalFlip = flip_h  # bool
tin.isVerticalFlip = flip_v
```

Same semantics as the Sketch Text dialog. Apply before `add`. Center constraints remain mandatory after flip/align rebuilds; hard-fail with reason if they cannot be applied.

## Command event split (low latency)

| Event | Role |
|-------|------|
| `inputChanged` (triad) | Fast pose: snap (unless Alt); translate/rotate → driven dims + `sketch.move`; unified scale → `heightParameter`; **no** solids |
| `mouseDragEnd` | Start debounce timer only — dims stay **driven** during wait |
| Debounce fire | **Auto-apply** Ref/Orient dims (driven → driving from pose) → then `doExecutePreview` |
| `executePreview` | Build/update **extrude or cut** preview; dims already driving |
| `inputChanged` (definition / snap / op) | Update sketch/state; debounced `doExecutePreview` when solids affected |
| `execute` | **Final commit only** (OK / `doExecute`) |
| `destroy` | Cancel timers; teardown preview; clear tokens |

```python
_busy = False
_preview_token = 0

def on_triad_input_changed(triad):
    global _busy
    if _busy:
        return
    _busy = True
    try:
        step = snap_step_unless_alt(mouse_args_or_cached_modifiers)
        frame.ensure_dims_driven()  # once per gesture
        delta = delta_matrix(triad.transform, triad.lastTransform, step)
        sketch.move(existing_text_entities, delta)
    finally:
        _busy = False

def on_mouse_drag_end(args):
    global _preview_token
    _preview_token += 1
    token = _preview_token
    # schedule ~100ms later — dims remain driven until fire():
    def fire():
        if token != _preview_token or _busy:
            return
        _busy = True
        try:
            # AUTO-APPLY: between debounce and execute preview
            frame.apply_driving_from_pose()  # Ref H/V (+ angle) → isDriving=True
            push_dims_to_gui(frame)
            cmd.doExecutePreview()           # solid preview sees driving dims
        finally:
            _busy = False
```

- **Auto-apply = convert to driving** runs after debounce fires and **before** `doExecutePreview`. Not at `mouseDragEnd`, not inside `executePreview`.
- Detect Alt bypass from `MouseEventArgs` modifiers during drag when available; cache last-known modifier state for triad `inputChanged` if needed.
- Never call `doExecutePreview` from inside `executePreview`.
- Do not rebuild on theme-only changes or Add Point hover (CG only).

### Dimension parameters — Triad ↔ GUI two-way

```python
# GUI → dims → pose
def on_gui_dim_changed(dx_expr, dy_expr, angle_expr):
    if _syncing_ui: return
    _syncing_ui = True
    try:
        if frame.dim_h: frame.dim_h.parameter.expression = dx_expr
        if frame.dim_v: frame.dim_v.parameter.expression = dy_expr
        if frame.dim_angle: frame.dim_angle.parameter.expression = angle_expr
        frame.retarget_triad_from_dims(triad)   # triad.transform matches new pose
        schedule_do_execute_preview()
    finally:
        _syncing_ui = False

# Triad → GUI (on tick and/or settle)
def push_dims_to_gui(frame):
    if _syncing_ui: return
    _syncing_ui = True
    try:
        send_to_palette(dX=frame.dim_h.parameter.expression, ...)
    finally:
        _syncing_ui = False
```

- Palette bridge actions: `setFrameDims`, `frameDimsChanged` with `{ dX, dY, angle }`.
- Typed GUI values are authoritative (not force-snapped); triad ticks still use snap unless Alt.

## Extrude from text

```python
extrudeFeatures.createInput(sketchText, FeatureOperations.…)
```

Do **not** require `sketch.profiles` for text — pass the `SketchText` object.

Operations used (stock Extrude set **minus New Component**):

- `JoinFeatureOperation` + `participantBodies`
- `CutFeatureOperation` + `participantBodies`
- `IntersectFeatureOperation` + `participantBodies`
- `NewBodyFeatureOperation` (no target body)
- **Do not** expose `NewComponentFeatureOperation`

Extent: **Depth** via `setDistanceExtent(isSymmetric, ValueInput)` or one-side extent; **Direction** = positive / negative / symmetric along sketch normal.

## Selection filters

- Points: `SketchPoint` (selection filter string / `SelectionEventHandler` accept).
- Sketches: `Sketches` filter for optional Add Point target.
- Planes/faces: construction plane / planar `BRepFace` when creating a sketch for Add Point.
- Bodies: `BRepBody` for Cut participants.

## Add Point — preselect + custom graphics preview

```python
# Placement mode (before commit):
# 1) cmd.preSelect / preSelectMouseMove → SelectionEventArgs.selection
#    hit_entity = selection.entity
#    hit_point  = selection.point          # model-space point on entity
# 2) Project hit onto target sketch plane:
sk_pt = sketch.modelToSketchSpace(hit_point)
sk_pt.z = 0  # ensure on sketch XY if needed
ghost_model = sketch.sketchToModelSpace(sk_pt)
# 3) Custom graphics ghost (replace each move — one group):
cg = rootComp.customGraphicsGroups.add()
# billboard point / small circle / coordinates at ghost_model
# optional: CustomGraphicsLines from hit_point → ghost_model (projection guide)
# 4) On click commit:
new_pt = sketch.sketchPoints.add(sk_pt)
cg.deleteMe()  # or clear group

# No sketch selected:
# - From preselect, resolve ConstructionPlane / planar BRepFace
# - sketches.add(plane); then same project + CG + commit
# - Fallback: rootComp.xYConstructionPlane
```

### Standalone `sketch_transform_frame` + `TriadCommandInput`

Lives at `EngravingTextOnPoint/sketch_transform_frame/`. **No engraving imports.**

```python
triad = inputs.addTriadCommandInput("triad", mat)
triad.hideAllScaling()
triad.isUnifiedScalingVisible = True  # only unified scale → text height

frame = TransformFrame.apply(
    sketch, target_pt,
    ref_point_entity=ref,
    orient_vector_entity=orient,
    angle_entity=text_baseline,
    angle_value="0 deg",
)
frame.ensure_visible(sketch)
frame.bind_triad(triad)

# inputChanged (triad) — branch on lastChangeMade
#   translate/rotate: snap + sketch.move; dims driven; no doExecutePreview
#   unified scale: height = height0 * triad.unifiedScaleFactor → heightParameter
frame.on_triad_changed(triad)

# mouseDragEnd → debounce wait (dims still driven) → auto-apply driving → doExecutePreview
frame.apply_driving_from_pose()  # between debounce fire and execute preview
triad.unifiedScaleFactor = 1.0   # height already committed to heightParameter
cmd.doExecutePreview()

# execute — FINAL COMMIT ONLY
commit_sketch_and_solids(...)
```

### Height via triad unified scale

```python
# Prefer heightParameter (retired SketchText.height).
hp = sketch_text.heightParameter
height0 = hp.value  # cm at gesture start

def on_unified_scale(triad):
    factor = triad.unifiedScaleFactor  # unitless
    if not triad.isValidExpressions:
        return
    h = max(height0 * factor, MIN_HEIGHT_CM)
    # optional: quantize h with linear snap unless Alt
    hp.value = h
    # sync palette Ht; do NOT apply Matrix3D scale via sketch.move
```

- Show **unified scale only** (`isUnifiedScalingVisible`); keep per-axis / plane scales hidden.
- Branch with `lastChangeMade` so translate/rotate path never applies scale, and scale path never `sketch.move`s a scaled matrix.
- Triad ticks: matrix-move **or** heightParameter write; dims driven during translate/rotate + debounce wait; visible always.
- Auto-apply: after debounce, before solid preview — Ref/Orient dims converted to driving from pose; reset unified scale to 1.0.
- Solid preview: `doExecutePreview` only after auto-apply (never while Ref dims are still driven).
- Final commit: `execute` / `doExecute` only.
- Re-entrancy: single-flight around move + height write + preview; cancel stale debounce tokens.
- Destroy CG on `preSelectEnd`, cancel, destroy, or after commit.

## Palette

- `ui.palettes.add(...)` with HTML from `resources/palette/palette.html`.
- JS bridge: `adsk.fusionSendData(action, json)` / `window.fusionJavaScriptHandler`.
- Keep HTML/CSS/JS under add-in folder; reload add-in after UI edits.

## Theme

```python
prefs = app.preferences.generalPreferences
# userInterfaceTheme may be DeviceUserInterfaceTheme
# activeUserInterfaceTheme is the resolved Light/Dark
```

## Fonts + Bold / Italic

Set `SketchTextInput.fontName = "Arial"` (or discovered name). Invalid names fail at `add` — validate against known list.

Palette **Font** cell groups **B** / **I** toggles with the font dropdown (Sketch Text Style + Font).

```python
# Bitwise TextStyles — combine bold + italic as needed
style = adsk.fusion.TextStyles.TextStyleRegular
if bold:
    style |= adsk.fusion.TextStyles.TextStyleBold  # verify enum names vs installed API
if italic:
    style |= adsk.fusion.TextStyles.TextStyleItalic
tin.textStyle = style
# Also on existing SketchText: sketch_text.textStyle = style
```

Confirm exact `TextStyles` member names against the installed Fusion build (`BoldTextDecoration` vs `TextStyleBold`, etc.).

## Transactions / timeline

Execute geometry inside command `execute` for undo. Group features:

```python
design.timeline.timelineGroups.add(startIndex, endIndex)
```

## Known risks

1. `rectangleLines` order must be verified once on target Fusion build; write a small probe script.
2. Bounding box may be stale on some text creation paths — prefer constraints over bbox math when possible.
3. Cut + `ThroughAll` has had API bugs; prefer distance or `ToEntity` for v1.
4. Embedded CEF may not load all OS fonts into `<option>` preview — fall back to UI font for missing faces while still sending name to Fusion.
5. Cut live preview can fail when the text does not yet intersect the target — degrade to text-only preview + status.
6. Large multi-point previews: rebuild cost scales with N; if needed later, dirty only changed rows.
