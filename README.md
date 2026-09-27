# Engraving Text on Point

Fusion 360 add-in: place centered sketch text on selected sketch points, then extrude as **Cut** or **New Body**.

## Status

Planning complete — see [docs/PLAN.md](docs/PLAN.md).

**Build order:** Phase 1 = **dummy UI** → Phase 2 = **`sketch_transform_frame` + Triad fast path** (no solids) → Phase 3 = extrude/cut on **`execute` only**.

## Highlights

- Table-style palette (stock Fusion look)
- Columns: Text, Height, **Angle** (dim), **Orient**, **Flip**, **Justify**, **Align**, Font
- Reusable **`sketch_transform_frame`** + **`TriadCommandInput`**: matrix-move existing sketch text on `inputChanged`
- Ref H/V + Orient angle dims; driven-during-drag; dims visible while positioning
- **Extrude/cut only on OK** — no solid regen on triad ticks (avoids jitter)
- **Add Point** with preselect + custom-graphics projection ghost
- Stock Fusion icons for flip / justify / align
- Themes: **Light (default)**, Dark, Auto

## Install (once implemented)

1. Copy `EngravingTextOnPoint/` into your Fusion AddIns folder.
2. Scripts and Add-Ins → run **EngravingTextOnPoint**.
3. Find the command on the Add-Ins / Solid toolbar panel configured in the manifest.
