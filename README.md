# Engraving Text on Point

Fusion 360 add-in: place centered sketch text on selected sketch points, then extrude as **Cut** or **New Body**.

## Status

Planning complete — see [docs/PLAN.md](docs/PLAN.md).

**Build order:** Dummy UI → Triad fast path + settle `doExecutePreview` → cut/target polish. **`execute` = final commit only.**

## Highlights

- **`TriadCommandInput`**: lightweight `sketch.move` on `inputChanged`
- **`mouseDragEnd` + debounce → `doExecutePreview`**: solid engraving preview after drag
- **Snap** dropdowns (linear + angular) with **Alt bypass**; re-entrancy guards
- Reusable **`sketch_transform_frame`**: Ref H/V + Orient angle dims
- Add Point with preselect + custom-graphics ghost
- Themes: **Light (default)** / Dark / Auto

## Install (once implemented)

1. Copy `EngravingTextOnPoint/` into your Fusion AddIns folder.
2. Scripts and Add-Ins → run **EngravingTextOnPoint**.
3. Find the command on the Add-Ins / Solid toolbar panel configured in the manifest.
