# Engraving Text on Point

Fusion 360 add-in: place centered sketch text on selected sketch points, then extrude as **Cut** or **New Body**, with **live preview**, per-row **angle**, **flip**, **justify**, and **align**.

## Status

Planning complete — see [docs/PLAN.md](docs/PLAN.md).

**Build order:** Phase 1 = **dummy UI** → Phase 2 = selection + **Add Point** + stock **transform manipulators** → then live preview / extrude.

## Highlights

- Table-style palette (stock Fusion look)
- Columns: Text, Height, **Angle**, **Flip**, **Justify** (L/C/R), **Align** (T/M/B), Font
- **Stock Fusion manipulators** for angle; move when the sketch point is unconstrained
- **Add Point** at click (selected sketch, or create sketch then point)
- Stock Fusion icons for flip / justify / align
- **Live preview** (on by default); Cancel/destroy leaves no preview geometry
- Batch sequential text with prefix / suffix
- Cut (optional target body) or New Body
- Themes: **Light (default)**, Dark, Auto

## Install (once implemented)

1. Copy `EngravingTextOnPoint/` into your Fusion AddIns folder.
2. Scripts and Add-Ins → run **EngravingTextOnPoint**.
3. Find the command on the Add-Ins / Solid toolbar panel configured in the manifest.
