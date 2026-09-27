# Icons

Prefer Fusion built-in command glyphs when packaging allows reuse.

| Asset folder | Intended stock source | Photoshop fallback |
|--------------|----------------------|--------------------|
| `command/` | Text / Extrude related add-in sample icons | Point + “T” badge, Fusion blue `#0696D7`, transparent PNG 16/32/64 |
| `point/` | Sketch point / select | Crosshair + point |
| `body/` | Body select | Solid body silhouette |
| `cut/` | Extrude Cut | Cutter + minus |
| `newbody/` | New Body | Body + plus |
| `flipH/` | **Stock Fusion Flip Horizontal** (Sketch Text dialog / flip-horizontal command resources) | Only if extract fails — retouch stock, do not invent |
| `flipV/` | **Stock Fusion Flip Vertical** | Same rule |

## Flip icons (required stock)

Copy from the local Fusion install’s UI resource packs (paths vary by OS/version), typically near Sketch Text / Modify flip command assets. Record the exact source path here when extracted:

```
# Example (fill in during icon pass):
# Windows: C:\Users\<user>\AppData\Local\Autodesk\webdeploy\...
# macOS:   /Users/<user>/Library/Application Support/Autodesk/...
flipH source: <TBD>
flipV source: <TBD>
```

Table buttons use **16×16** (light + dark if available).

Naming for Fusion command icons (per folder):

- `16x16-normal.png`
- `32x32-normal.png`
- `64x64-normal.png`
- `16x16-dark.png` (optional)
- `32x32-dark.png` (optional)

Placeholder 1×1 PNGs are not committed yet — export finals during Phase 0 icon pass.
