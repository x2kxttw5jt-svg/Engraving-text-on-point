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
# detail = str(exception) or a precise local check message
```

Do not swallow Fusion exceptions into a generic toast; chain `detail` from the original error.

### Angle

`SketchTextInput.setAsMultiLine(cornerOne, cornerTwo, hAlign, vAlign, angle)` — **angle is in radians**.

```python
angle_rad = design.unitsManager.evaluateExpression(angle_user_str, "rad")
# or math.radians(degrees) when the palette sends a plain number
```

Rotate about the text center (center alignment + center constraint to the sketch point). Rebuild text on angle change during preview rather than trying to animate in place.

### Flip

```python
tin.isHorizontalFlip = flip_h  # bool
tin.isVerticalFlip = flip_v
# Also readable/writable on SketchText after add
```

Same semantics as the Sketch Text dialog flips. Apply on `SketchTextInput` before `add` during preview/execute rebuilds. Center constraints remain mandatory after flip; hard-fail with reason if they cannot be applied.

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
- Bodies: `BRepBody` for Cut participants.

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
