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
