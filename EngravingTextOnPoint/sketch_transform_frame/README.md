# sketch_transform_frame

Standalone Fusion helper: associative Ref H/V + Orient angle dims, **`TriadCommandInput`** (translate / rotate / unified scale→height), driven-during-drag, visibility.

**No imports from host add-ins.** Copy this folder to reuse.

## Low-latency contract (host command)

| Stage | Event | Work |
|-------|-------|------|
| Fast pose | `inputChanged` (triad) | Translate/rotate: snap → `sketch.move`; **unified scale → host height callback** (not matrix scale); dims driven on move/rotate; **no** `doExecutePreview` |
| Debounce wait | after `mouseDragEnd` | Dims stay **driven**; no solid preview yet |
| Auto-apply | debounce fire, **before** preview | Driven Ref/Orient dims → **driving** from measured pose |
| Solid preview | then `doExecutePreview` | Host `executePreview` builds extrude/cut (dims already driving) |
| Commit | `execute` / `doExecute` | Final commit only |

Re-entrancy: host keeps a busy flag + preview token so overlapping moves/previews coalesce.

## Public API (planned)

```python
frame = TransformFrame.apply(sketch, target_point, ref_point_entity=..., orient_vector_entity=..., angle_entity=..., angle_value="0 deg")
frame.ensure_visible(sketch)
frame.bind_triad(triad_input)

frame.on_triad_changed(triad, snap_linear_cm=..., snap_angle_rad=..., alt_bypass=False)
# Host handles unified scale → SketchText.heightParameter (engraving-specific).
# Host: mouseDragEnd → debounce → then:
frame.apply_driving_from_pose()  # auto-apply: driven → driving; alias on_triad_settled()
# Host: reset triad.unifiedScaleFactor = 1.0; then doExecutePreview()
```

Triad setup: `hideAllScaling()` then `isUnifiedScalingVisible = True` (per-axis / plane scales stay off).

## Modules

| File | Role |
|------|------|
| `project.py` | Associative `project2` |
| `apply_frame.py` | H/V + angular dims |
| `drag_cadence.py` | Driven during drag; auto-apply driving after debounce |
| `manipulators.py` | Triad delta matrix + optional snap quantize |
| `visibility.py` | Keep dims visible |
| `errors.py` | Staged hard-fail errors |
