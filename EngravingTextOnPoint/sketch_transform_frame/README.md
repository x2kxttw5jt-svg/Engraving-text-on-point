# sketch_transform_frame

Standalone Fusion helper: associative Ref H/V + Orient angle dims, **`TriadCommandInput`**, driven-during-drag, visibility.

**No imports from host add-ins.** Copy this folder to reuse.

## Low-latency contract (host command)

| Stage | Event | Work |
|-------|-------|------|
| Fast pose | `inputChanged` (triad) | Snap (unless Alt) → `sketch.move` existing entities; dims driven; **no** `doExecutePreview` |
| Solid preview | `mouseDragEnd` → debounce → `doExecutePreview` | Host `executePreview` builds extrude/cut |
| Commit | `execute` / `doExecute` | Final commit only |

Re-entrancy: host keeps a busy flag + preview token so overlapping moves/previews coalesce.

## Public API (planned)

```python
frame = TransformFrame.apply(sketch, target_point, ref_point_entity=..., orient_vector_entity=..., angle_entity=..., angle_value="0 deg")
frame.ensure_visible(sketch)
frame.bind_triad(triad_input)

frame.on_triad_changed(triad, snap_linear_cm=..., snap_angle_rad=..., alt_bypass=False)
frame.on_triad_settled()  # restore driving dims from pose
```

## Modules

| File | Role |
|------|------|
| `project.py` | Associative `project2` |
| `apply_frame.py` | H/V + angular dims |
| `drag_cadence.py` | Driven/driving toggle |
| `manipulators.py` | Triad delta matrix + optional snap quantize |
| `visibility.py` | Keep dims visible |
| `errors.py` | Staged hard-fail errors |
