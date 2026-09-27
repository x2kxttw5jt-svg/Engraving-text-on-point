# Engraving Text on Point

Fusion 360 add-in: place centered sketch text on selected sketch points, then extrude as **Cut** or **New Body**.

## Status

Planning complete — see [docs/PLAN.md](docs/PLAN.md).

## Highlights

- Table-style palette (stock Fusion look)
- Columns: Text, Height, Font (text field renders in selected font)
- Batch sequential text with prefix / suffix
- Cut (optional target body) or New Body
- Themes: **Light (default)**, Dark, Auto
- Built-in Fusion icons when available; Photoshop fallbacks documented under `resources/icons/`

## Install (once implemented)

1. Copy `EngravingTextOnPoint/` into your Fusion AddIns folder.
2. Scripts and Add-Ins → run **Engraving TextOnPoint**.
3. Find the command on the Add-Ins / Solid toolbar panel configured in the manifest.
