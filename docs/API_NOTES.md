# API Notes — Fusion 360

Target: current Fusion production API (2024+ multiline text). Python add-in.

## Sketch text

| Prefer | Avoid |
|--------|--------|
| `SketchTexts.createInput2(text, height)` + `setAsMultiLine(...)` | Retired `createInput(text, height, point)` for new work |
| `SketchText.definition` → `MultiLineTextDefinition.rectangleLines` | Retired `SketchText.boundaryLines` |

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

### Angle = associative project of Orient vector + driving angular dimension

Do **not** use retired `SketchText.angle` / `SketchTextInput.angle`.

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
- `setAsMultiLine` 5th arg is **characterSpacing** (%), not angle.

### Flip

```python
tin.isHorizontalFlip = flip_h  # bool
tin.isVerticalFlip = flip_v
```

Same semantics as the Sketch Text dialog. Apply before `add`. Center constraints remain mandatory after flip/align rebuilds; hard-fail with reason if they cannot be applied.

## Live preview (`executePreview`)

- Keep a long-lived **Command** while the palette is open.
- Palette/`SelectionEvent` changes set a dirty flag and call into the command so Fusion invokes `CommandEventHandler.notify` on **preview**.
- In preview: create sketch texts + extrudes; Fusion rolls them back before the next preview/execute unless committed.
- On **destroy** / cancel: do not commit; clear any non-preview bookmarks the add-in holds (entity tokens, selection).
- Debounce typing (~150 ms). Single-flight: ignore overlapping rebuild requests.
- Do not rebuild on theme-only changes or pointer hover during selection.

Optional fallback if command-preview + palette bridging is awkward on a given Fusion build: manually create/delete preview entities in a named timeline bookmark and delete on cancel — prefer official `executePreview` first.

## Extrude from text

```python
extrudeFeatures.createInput(sketchText, FeatureOperations.…)
```

Do **not** require `sketch.profiles` for text — pass the `SketchText` object.

Operations used:

- `CutFeatureOperation` + optional `participantBodies`
- `NewBodyFeatureOperation`

Extent: `setDistanceExtent(isSymmetric, ValueInput)` or `setOneSideExtent` for direction control.

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
sketch.sketchPoints.add(sk_pt)
cg.deleteMe()  # or clear group

# No sketch selected:
# - From preselect, resolve ConstructionPlane / planar BRepFace
# - sketches.add(plane); then same project + CG + commit
# - Fallback: rootComp.xYConstructionPlane
```

- Destroy CG on `preSelectEnd` (hide ghost when leaving valid hit), cancel, destroy, or after commit.
- Do not leave custom graphics after placement mode ends.
- Filter preselect: set `args.isSelectable = False` when hit cannot project onto the target plane.

## Stock transform manipulators

Host on the active Command (palette alone cannot draw them):

```python
angle_in = inputs.addAngleValueCommandInput(id_angle, "Angle", adsk.core.ValueInput.createByString("0 deg"))
# x_dir = orientation vector in sketch plane (0°); y_dir = rotated 90° in plane
angle_in.setManipulator(origin, x_dir, y_dir)
# on change: active_row.angular_dimension.parameter.value = angle_in.value

dist_x = inputs.addDistanceValueCommandInput(...)
dist_x.setManipulator(origin, sketch_x_dir)
# enable move only when point unconstrained; enable angle only when Orient is set
```

- Sync `angle_in` ↔ Angle column ↔ **angular dimension parameter**.
- Angle-only edits should not delete/recreate `SketchText`.
- Unconstrained move: `SketchPoint.move` / `sketch.move`; surface reason if blocked.
- Retarget manipulators when active row or Orient vector changes.

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

## Fonts

Set `SketchTextInput.fontName = "Arial"` (or discovered name). Invalid names fail at `add` — validate against known list.

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
