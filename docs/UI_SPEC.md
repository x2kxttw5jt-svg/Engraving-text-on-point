# UI Spec — Engraving Text on Point Palette

## Design intent

Match Fusion’s native docked palettes (Parameters-adjacent density, Extrude-dialog field rhythm). One composition: toolbar of options above a data table — not a dashboard of cards.

**Dummy UI first:** implement this spec as a fully clickable mock (fake rows, no Fusion geometry) and sign off visuals/interactions before wiring selection, manipulators, constraints, or extrude.

## Selection / Add Point row

- `Point(s)` Select + **`+ Add Point`** button (stock-style + or point icon).
- Optional **`Ref Pt` Select** + **`Apply Ref Dims`** (initial attach) — via reusable `sketch_transform_frame` (H/V + angle when Orient set) for Add Point or existing unconstrained points. After triad drag: Ref dims stay driven through debounce, then **auto-apply** (convert to driving) before solid preview. Frame dims stay **visible during live preview** (including driven-during-drag).
- Optional `Sketch` Select (muted helper text: used by Add Point).
- **`Orient` Select** — **global** orientation vector for **every** table row (not per-row). Required for Angle; angular dims use the same projected reference on each row’s frame.
- Status strip: `Angle dim ✓` (or `Select orientation vector`), `Move ✓` / `Move locked — point is constrained`, and `Scale→Ht ✓` (triad unified scale drives text height).
- During Add Point mode, status: `Click to place point — ghost shows projected location`.

## Tokens

```css
:root, [data-theme="light"] {
  --bg: #f5f5f5;
  --bg-elevated: #ffffff;
  --bg-row-hover: #eaf6fc;
  --bg-header: #eeeeee;
  --text: #3c3c3c;
  --text-muted: #6b6b6b;
  --border: #d0d0d0;
  --accent: #0696d7;
  --accent-hover: #0076a5;
  --danger: #d9534f;
  --input-bg: #ffffff;
  --focus: #0696d7;
  --row-height: 28px;
  --font-ui: "Artifakt Element", "Segoe UI", system-ui, sans-serif;
}

[data-theme="dark"] {
  --bg: #333333;
  --bg-elevated: #3c3c3c;
  --bg-row-hover: #2a4a5a;
  --bg-header: #2b2b2b;
  --text: #f5f5f5;
  --text-muted: #b0b0b0;
  --border: #555555;
  --accent: #0696d7;
  --accent-hover: #3db5e8;
  --input-bg: #2b2b2b;
}
```

## Theme resolution

```
userChoice = settings.theme   // "light" | "dark" | "auto"  default "light"
if userChoice == "auto":
  resolved = Fusion.activeUserInterfaceTheme  // LightUserInterfaceTheme | Dark…
else:
  resolved = userChoice
document.documentElement.dataset.theme = resolved
```

On palette show and on a low-frequency timer / Fusion theme change hook, re-resolve Auto.

## Table

- Sticky header row; table may scroll horizontally in a narrow dock, but **Text wraps** when the palette is compressed so content stays readable.
- **Rows are resizable** — drag the right-edge handle (or the Text field’s vertical resize) to grow/shrink row height; Text textarea autosizes with content.
- Columns: `#` | Text | Ht | **Angle** | **Format** | Font. (no Orient column — Orient is global above the table)
- **Format** (one column), stacked like Fusion Sketch Text:
  1. Flip H | Flip V (mirrored-triangle icons)
  2. Justify L | C | R (text-line icons)
  3. Align T | M | B (block + guideline icons)
- **Active** control: thin **accent blue border** + subtle row-hover fill (not a heavy dark fill).
- Dummy uses SVG stand-ins under `resources/palette/static/icons/`; prefer stock Fusion PNGs when packaging.
- **Ht** is two-way with triad **unified scale** (same `heightParameter`); typed Ht resets triad scale factor to 1.0.
- Text `<input>`: `style.fontFamily = selectedFont`.
- Angle `<input>`: per-row angular dimension value vs the **global** Orient; **hidden** until Orient is set.
- **Font** cell: **Bold (B)** + **Italic (I)** stacked vertically, grouped with the font `<select>`. Active B/I use accent blue border.
- Font `<select>` + B/I: the row **Text** field updates live the same way — `font-family`, bold weight, and italic style.
- No card wrappers; hairline row borders only.
- Selection highlight uses `--bg-row-hover` / accent left bar (2px) optional.

## Extrude block

- **Operation** — Fusion Extrude–style dropdown: **icon + name** per option. Options: **Join**, **Cut**, **Intersect**, **New Body**. **Exclude New Component.** Prefer stock Extrude command icons when packaged; dummy uses SVG stand-ins.
- **Depth** — length input (default `1 mm`); engraving cut depth or positive extrude distance.
- **Direction** — `Positive` / `Negative` / `Symmetric` along sketch normal (supports positive Join / Intersect / New Body).
- **Live solid preview** checkbox (default checked): controls **extrude/cut solid preview** after triad `mouseDragEnd` + debounce → auto-apply driving dims → `doExecutePreview`. Sketch text / dims / triad pose still update live regardless.
- **Snap** dropdowns: linear + angular increments; label hint `Alt = free`.
- **Frame dims** row (active selection): `dX`, `dY`, `Angle` text inputs — same driving dimensions as the triad. **Hidden** until the matching dim exists (dX/dY after Ref dims applied; Angle after Orient set). Whole Frame row hidden when none apply.
- Table **Angle** column is the same parameter as the frame Angle field (keep in sync); **hidden** until Orient is set.
- When solid preview unchecked: triad / sketch still update; skip settle `doExecutePreview`; OK commits solids.

## Selection rows

Icon button (16×16) + label + count badge (plain text, not pill chrome).

**Hide, don’t grey:** unavailable controls stay `hidden` until their use condition is met — never opacity-disabled placeholders.

| Control | Shown when |
|---------|------------|
| **Apply Ref Dims** | Ref point selected |
| **Target Body** | Operation = Join, Cut, or Intersect |
| Frame **dX** / **dY** | Ref H/V dims applied |
| Frame **Angle** + table Angle column | Orient set |
| **OK** | ≥1 point / table row |

## Buttons

Primary OK = accent fill, white text (hidden until a point exists). Cancel = flat border. Height 28px. Right-aligned footer.

## Motion (minimal, stock-like)

1. Row insert: 120ms fade/height.
2. Batch toggle: 150ms grid expand.
3. Theme switch: instant token swap (no long transitions).
4. Preview itself is viewport geometry — no extra palette animation for preview ticks.

Avoid decorative motion / glow.
