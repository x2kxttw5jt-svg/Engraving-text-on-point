# UI Spec — Engraving Text on Point Palette

## Design intent

Match Fusion’s native docked palettes (Parameters-adjacent density, Extrude-dialog field rhythm). One composition: toolbar of options above a data table — not a dashboard of cards.

**Dummy UI first:** implement this spec as a fully clickable mock (fake rows, no Fusion geometry) and sign off visuals/interactions before wiring selection, manipulators, constraints, or extrude.

## Selection / Add Point row

- `Point(s)` Select + **`+ Add Point`** button (stock-style + or point icon).
- Optional `Sketch` Select (muted helper text: used by Add Point).
- **`Orient` Select** — required direction vector for text angle (sketch line / axis / edge).
- Status strip: `Angle dim ✓` (or `Select orientation vector`) and `Move ✓` / `Move locked — point is constrained`.
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

- Sticky header row; table may scroll horizontally in a narrow dock.
- Columns: `#` | Text | Ht | **Angle** (dim value) | **Orient** (vector label) | Flip | Justify | Align | Font.
- Text `<input>`: `style.fontFamily = selectedFont`.
- Angle `<input>`: **angular dimension** value (not a SketchText angle — that API is retired); placeholder `0`; unit `deg`. Disabled until Orient is set.
- Orient: short label of selected vector + per-row pick control (or “global”).
- Flip: two 16×16 icon toggles (stock Fusion Flip H/V). `aria-pressed` + tooltips.
- Justify: exclusive group of three icon buttons — Left / Center / Right (stock Fusion). `role="radiogroup"`; one `aria-checked` at a time. Default Center.
- Align: exclusive group Top / Middle / Bottom (stock Fusion). Same radio pattern. Default Middle.
- Active icon = accent border or depressed `--bg-row-hover` (match Fusion tool toggles).
- Font `<select>`: each `<option style="font-family: name">`.
- No card wrappers; hairline row borders only.
- Selection highlight uses `--bg-row-hover` / accent left bar (2px) optional.

## Extrude block extras

- **Live preview** checkbox (default checked), left-aligned under Direction.
- When unchecked, status line: `Preview off — OK will create features`.

## Selection rows

Icon button (16×16) + label + count badge (plain text, not pill chrome).

Disabled Target Body row when operation ≠ Cut (opacity 0.45, pointer-events none).

## Buttons

Primary OK = accent fill, white text. Cancel = flat border. Height 28px. Right-aligned footer.

## Motion (minimal, stock-like)

1. Row insert: 120ms fade/height.
2. Batch toggle: 150ms grid expand.
3. Theme switch: instant token swap (no long transitions).
4. Preview itself is viewport geometry — no extra palette animation for preview ticks.

Avoid decorative motion / glow.
