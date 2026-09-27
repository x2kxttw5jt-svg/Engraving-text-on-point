# sketch_transform_frame

Standalone Fusion 360 helper for **associative reference frames** on a sketch point:

- Optional **Ref point** → linked project + driving **H/V** distance dimensions  
- Optional **Orient vector** → linked project + driving **angular** dimension to a caller-supplied edge/line  
- Stock **`TriadCommandInput`** for translate + rotate (no scale)  
- **Fast path:** matrix `sketch.move` of existing entities on `inputChanged` (no rebuild)  
- **Driven-during-drag / driving-on-stop** to avoid solver lag  
- Dimension **visibility** during interaction  

This package must **not** import application-specific add-in code. Copy the folder to reuse.

## Public API (planned)

```python
from sketch_transform_frame import TransformFrame

frame = TransformFrame.apply(
    sketch,
    target_point,
    ref_point_entity=ref,
    orient_vector_entity=orient,
    angle_entity=text_edge,
    angle_value="0 deg",
)
frame.ensure_visible(sketch)
frame.bind_triad(triad_input)  # hide scaling; sketch-plane translate + normal rotate

# Host command inputChanged when triad changes:
frame.on_triad_changed(triad)
#  - first tick of gesture: dims → driven
#  - delta = transform * inv(lastTransform)
#  - sketch.move(tracked_entities, delta)   # existing text/point — immediate
#  - never calls executePreview / extrude

# Host detects drag settle (mouseup / idle):
frame.on_triad_settled()
#  - write H/V/angle from pose → dims → driving again
```

## Low-latency contract

| Allowed on triad tick | Forbidden on triad tick |
|----------------------|-------------------------|
| `sketch.move` existing entities | `executePreview` |
| Toggle owned dims driven | Create/delete SketchText |
| Update triad pose | Create/delete Extrude/Cut |
| Keep dims visible | `computeAll` / full feature rebuild |

Host add-ins regenerate solids only in **`Command.execute`**.

## Modules

| File | Role |
|------|------|
| `project.py` | Associative `project2` helpers |
| `apply_frame.py` | Create H/V + angular dims; return `TransformFrame` |
| `drag_cadence.py` | Driven/driving toggle for translate & rotate gestures |
| `manipulators.py` | Triad bind + delta-matrix application |
| `visibility.py` | Keep frame dims visible |
| `errors.py` | Staged hard-fail errors |

## Hard-fail stages (examples)

`ref dims blocked`, `ref associative project failed`, `horizontal dimension failed`, `vertical dimension failed`, `orient vector missing`, `associative project failed`, `projected line unavailable`, `angular dimension failed`, `restore driving dims failed`, `sketch move failed`.
