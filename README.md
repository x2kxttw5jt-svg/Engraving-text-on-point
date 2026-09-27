# Engraving Text on Point

Fusion 360 add-in: place centered sketch text on selected sketch points, then extrude as **Join**, **Cut**, **Intersect**, or **New Body** (no New Component), with **Depth** and **Direction**.

## Status

Planning complete — see [docs/PLAN.md](docs/PLAN.md).

**Build order:** Dummy UI → Triad fast path + debounce → auto-apply driving → `doExecutePreview` → cut/target polish. **`execute` = final commit only.**

## Highlights

- **`TriadCommandInput`**: translate/rotate via `sketch.move`; **unified scale → text height**
- **`mouseDragEnd` + debounce → auto-apply Ref dims to driving → `doExecutePreview`**
- **Snap** dropdowns (linear + angular) with **Alt bypass**; re-entrancy guards
- Frame **dX / dY / Angle** and **Ht** set via **triad or GUI** (two-way sync)
- Reusable **`sketch_transform_frame`**: Ref H/V + Orient angle dims
- Add Point with preselect + custom-graphics ghost
- Themes: **Light (default)** / Dark / Auto

## Install (once implemented)

1. Copy `EngravingTextOnPoint/` into your Fusion AddIns folder.
2. Scripts and Add-Ins → run **EngravingTextOnPoint**.
3. Find the command on the Add-Ins / Solid toolbar panel configured in the manifest.
