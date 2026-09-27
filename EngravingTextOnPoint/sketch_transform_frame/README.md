# sketch_transform_frame

Standalone Fusion 360 helper for **associative reference frames** on a sketch point:

- Optional **Ref point** → linked project + driving **H/V** distance dimensions  
- Optional **Orient vector** → linked project + driving **angular** dimension to a caller-supplied edge/line  
- Stock **manipulators** (angle + translate)  
- **Driven-during-drag / driving-on-stop** to avoid solver lag  
- Dimension **visibility** during live preview  

This package must **not** import application-specific add-in code (e.g. EngravingTextOnPoint). Copy the whole folder into another add-in to reuse.

## Public API (planned)

```python
from sketch_transform_frame import TransformFrame

frame = TransformFrame.apply(
    sketch,
    target_point,
    ref_point_entity=ref,          # optional
    orient_vector_entity=orient,   # optional
    angle_entity=text_edge,        # required if orient set — line to angle against projected orient
    angle_value="0 deg",
)
frame.ensure_visible(sketch)
frame.bind_manipulators(angle_input, dist_x_input, dist_y_input)

# translate gesture
frame.begin_translate_drag()
# ... move point ...
frame.end_translate_drag()

# rotate gesture
frame.begin_rotate_drag()
# ... rotate via angle manipulator ...
frame.end_rotate_drag()
```

## Modules

| File | Role |
|------|------|
| `project.py` | Associative `project2` helpers; hard-fail reasons |
| `apply_frame.py` | Create H/V + angular dims; return `TransformFrame` |
| `drag_cadence.py` | Toggle `isDriving` for translate/rotate gestures |
| `manipulators.py` | Sync command inputs ↔ dimension parameters |
| `visibility.py` | Keep frame dims visible during preview/drag |
| `errors.py` | Staged errors with reason strings |

## Hard-fail stages (examples)

`ref dims blocked`, `ref associative project failed`, `horizontal dimension failed`, `vertical dimension failed`, `orient vector missing`, `associative project failed`, `projected line unavailable`, `angular dimension failed`, `restore driving dims failed`.

## Notes

- There is **no** SketchText placement angle API — angle is always a sketch angular dimension.  
- Do not leave dimensions driven after a gesture ends.  
- Fusion API property names (`isDriving`, `project2` link flag) must be verified on the target build.
