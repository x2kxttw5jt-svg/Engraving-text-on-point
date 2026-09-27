# Engraving Text on Point — Feature Plan

## Goal

A Fusion 360 Python add-in that lets the user pick sketch points, place centered sketch text on each point, then extrude that text as **Cut** or **New Body**, with an optional target body. The UI is a **stock-looking table palette** (light default, dark, auto) that supports per-row text/height/font/**angle**/**flip**/**justify**/**align** and **batch sequential text** with prefix/suffix. Changes show as a **live preview** in the design; Cancel/destroy removes all preview geometry.

---

## User flow

```
Toolbar button → Command starts + Palette opens
  ↓
[Point] selection (multi-select sketch points) → rows appear; live preview places text
  ↓
Edit Text / Height / Font / Angle / Flip / Justify / Align (or Batch) → preview updates (debounced)
  ↓
Choose Extrude: Cut | New Body → preview extrude updates
  ↓
If Cut: enable Target Body picker → cut preview targets that body
  ↓
Set Distance / Direction → preview extent updates
  ↓
OK → commit preview (or rebuild once in execute) + timeline group
Cancel / close → delete all preview entities; no leftovers
```

---

## Palette UI (stock Fusion look)

### Layout

Dockable HTML palette (`adsk.core.Palettes`), width ~460–520px (align/justify columns), height flexible. Horizontal scroll on the table is OK if the dock is narrow.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Engraving Text on Point                                       [?] │
├──────────────────────────────────────────────────────────────────────┤
│  ⊙ Point(s)     [ Select ]     3 selected                            │
│  ⬚ Target Body  [ Select ]     (Cut only)                            │
├──────────────────────────────────────────────────────────────────────┤
│  Operation   (•) Cut  ( ) New Body                                   │
│  Distance    [ 1.0 mm ▼ ]                                            │
│  Direction   (•) Positive  ( ) Negative                              │
│  ☑ Live preview                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ☐ Batch sequence                                                    │
│    Prefix [PN-]  Start [1]  Digits [3]  Suffix [-A]  Step [1]        │
├──────────────────────────────────────────────────────────────────────┤
│  # │ Text │ Ht │ Angle │ Flip │ Justify │ Align │ Font              │
│ ───┼──────┼────┼───────┼──────┼─────────┼───────┼───────────────────│
│  1 │ …    │ 3  │ 0 °   │ ↔ ↕  │ [L][C][R]│ [T][M][B]│ Arial ▼       │
│  2 │ …    │ 3  │ 45 °  │ ↔ ↕  │ [L][C][R]│ [T][M][B]│ Arial ▼       │
├──────────────────────────────────────────────────────────────────────┤
│  Theme  [ Light ▼ ]                     [ Cancel ]  [ OK ]           │
└──────────────────────────────────────────────────────────────────────┘
```

Icon groups use **stock Fusion glyphs** from the Sketch Text dialog family (Flip H/V, Align Left/Center/Right, Align Top/Middle/Bottom) — not custom art.

### Table columns

| Column | Control | Notes |
|--------|---------|--------|
| `#` | Read-only index | Selection order |
| Text | `<input type="text">` | Batch-driven or override; `font-family` = selected font |
| Height | Length input | Default `3 mm` |
| **Angle** | Angle input (degrees) | Default `0`; per-row |
| **Flip** | Two icon toggles | H + V → `isHorizontalFlip` / `isVerticalFlip`; default off |
| **Justify** | 3-way icon radio | Left / Center / Right → `HorizontalAlignments`; default **Center** |
| **Align** | 3-way icon radio | Top / Middle / Bottom → `VerticalAlignments`; default **Middle** |
| Font | `<select>` | Options styled in that font; drives Text input face |

Optional header “apply to all” for angle / flip / justify / align.

**Justify vs Align (Fusion semantics)**

- **Justify** = horizontal alignment of text **within** the text rectangle (`LeftHorizontalAlignment` / `CenterHorizontalAlignment` / `RightHorizontalAlignment`).
- **Align** = vertical alignment within the rectangle (`TopVerticalAlignment` / `MiddleVerticalAlignment` / `BottomVerticalAlignment`).
- The rectangle **center remains constrained to the sketch point** (associativity unchanged). Changing justify/align reflows glyphs in the box; it does not move the constraint anchor off the point.

### Batch sequence behavior

- Toggle **Batch sequence** on → Text column becomes driven by formula:
  - `display = prefix + str(start + i*step).zfill(digits) + suffix`
  - Example: `PN-` + `001` + `-A` → `PN-001-A`, `PN-002-A`, …
- Changing prefix/suffix/start/digits/step re-writes all non-overridden rows **and refreshes live preview**.
- Per-row “override” flag: user edits Text → that row stops auto-updating until batch is toggled off/on or “Reset batch texts” is clicked.
- Batch does **not** drive Angle, Flip, Justify, or Align (stay per-row unless “apply to all”).
- Iteration order = order points were selected (stable).

### Stock Fusion visual language

- CSS variables matching Fusion palette chrome:
  - Light (default): `#F5F5F5` / `#FFFFFF` surfaces, `#3C3C3C` text, `#0696D7` accent, 1px `#D0D0D0` rules, 2–3px radius (not pill).
  - Dark: `#333333` / `#3C3C3C` surfaces, `#F5F5F5` text, same accent.
- Typography: `Artifakt Element` when available, else Segoe UI / system-ui. **Do not** use Inter/Roboto as brand.
- Controls: flat inputs, thin borders, compact 24–28px row height — no card chrome, no multi-layer shadows, no purple gradients.

### Theme: Light | Dark | Auto

| Mode | Behavior |
|------|----------|
| **Light** (default) | Force light tokens regardless of Fusion theme |
| Dark | Force dark tokens |
| Auto | Follow `activeUserInterfaceTheme`; `prefers-color-scheme` as secondary in the web view |

Persist in `settings.json`. Default `"theme": "light"`.

---

## Live preview

### Requirements

- As soon as ≥1 point is selected and row fields are valid, the viewport shows the engraving result for current options.
- Editing Text / Height / Font / Angle / Flip / Justify / Align / Distance / Direction / Operation / Target body updates the preview.
- **Cancel**, palette close, command destroy, or un-selecting a point **deletes** that row’s preview entities. Nothing left in the timeline or sketches from cancelled sessions.
- OK commits a clean final result (see Commit strategy).

### Architecture

Host a Fusion **Command** for the session (palette is the UI). Preview runs through the command’s **`executePreview`** path so Fusion handles rollback of preview features between ticks.

```
Palette change / selection change
  → debounce (~120–200 ms for text typing; immediate for point add/remove)
  → mark command inputs dirty / fire preview
  → executePreview:
        destroy prior preview set for this command tick (Fusion rolls back)
        for each row: create sketch text (centered, angled) + constraints
        for each row: extrude Cut | New Body (participantBodies if Cut)
  → execute (OK):
        same builder with commit=True (or accept last preview — prefer explicit rebuild)
  → destroy / cancel:
        no commit; all preview geometry gone
```

### Cadence / performance rules

| Event | Preview action |
|-------|----------------|
| Command created / palette shown | Warm font list, unit prefs, empty preview |
| Point added / removed | Rebuild preview for affected rows (full set OK for modest N) |
| Text / height / font / angle edit | Debounced rebuild |
| Flip H / V toggle | Immediate rebuild (cheap boolean) |
| Justify / Align change | Immediate rebuild |
| Distance / direction / operation / target | Rebuild extrude portion (full rebuild OK v1) |
| Theme-only change | **No** geometry rebuild |
| Mouse move during point pick (hover) | **No** rebuild — only on selection accept |

Do **not** call heavy ensure/compute paths from hover handlers. Keep a single `PreviewSession` object holding row → entity tokens; clear on cancel/destroy.

### Preview vs final

- Preview and final use the **same builder** (`lib/text_on_point.py` + `lib/extrude_text.py`) with a `preview: bool` flag only for naming (`_Preview` suffix on features/sketches if needed) and for skipping timeline group until commit.
- Prefer creating text in the **existing sketch** of each point for both preview and final so constraints stay associative.
- Cut preview may be expensive; if Cut preview fails (no intersection yet), show sketch text only + status “Cut preview pending — adjust distance/target”.

### Live preview toggle

Checkbox **Live preview** (default **on**). When off: no geometry until OK (still validates inputs). Persist in `settings.json` as `"livePreview": true`.

---

## Icons

Prefer built-in Fusion glyphs; else Photoshop 16/32/64 PNGs (see `resources/icons/README.md`).

| Action | Preferred stock | Fallback |
|--------|-----------------|----------|
| Command | Extrude / Text | Point + “T”, Fusion blue |
| Point select | SketchPoint | Crosshair |
| Body select | BRep body | Body silhouette |
| Cut / New Body | Extrude Cut / New Body | Cutter / plus+body |
| **Flip Horizontal** | **Stock Fusion Flip Horizontal** (Sketch Text family) | Photoshop retouch of stock only |
| **Flip Vertical** | **Stock Fusion Flip Vertical** | Same |
| **Justify L/C/R** | **Stock Fusion text align left / center / right** | Same |
| **Align T/M/B** | **Stock Fusion text align top / middle / bottom** | Same |

Ship under `resources/icons/flipH|flipV|justifyLeft|justifyCenter|justifyRight|alignTop|alignMiddle|alignBottom/` (16×16; light/dark if available). Record Fusion install source paths in `resources/icons/README.md`.

---

## Geometry & API design

### 1. Point selection

- Multi-select `SketchPoint`; each → row + tokens `{ sketchEntityToken, pointEntityToken, component }`.
- Allow multi-sketch; process per parent sketch under one timeline group on commit.

### 2. Centered, angled sketch text

```python
tin = sketch.sketchTexts.createInput2(text, height_cm)
cx, cy = point.geometry.x, point.geometry.y
half_w, half_h = estimate_half_extents(text, height_cm, font)
h_align = horizontal_alignments[justify]   # left|center|right
v_align = vertical_alignments[align]       # top|middle|bottom
# 5th arg is characterSpacing on current API; set angle via supported angle property/path (see API_NOTES)
tin.setAsMultiLine(
    adsk.core.Point3D.create(cx - half_w, cy - half_h, 0),
    adsk.core.Point3D.create(cx + half_w, cy + half_h, 0),
    h_align,
    v_align,
    0.0)  # characterSpacing %
tin.fontName = font_name
tin.isHorizontalFlip = flip_h
tin.isVerticalFlip = flip_v
# apply angle_deg via the current Fusion angle API for multiline text
sk_text = sketch.sketchTexts.add(tin)
```

**Justify + Align columns**

- Two exclusive icon groups per row (radio behavior): Justify L/C/R, Align T/M/B.
- Stock Fusion SketchText alignment icons; pressed state on the active choice.
- Defaults: **Center** + **Middle** (matches center-on-point framing).
- Maps to `adsk.core.HorizontalAlignments` / `VerticalAlignments` in `setAsMultiLine`.
- Live preview updates immediately; center constraint to the sketch point remains mandatory after rebuild.

**Flip column**

- Two per-row toggle buttons with **stock Fusion flip icons** (horizontal / vertical).
- Active (pressed) state when that flip is on — match Fusion toolbar toggle chrome (accent border or depressed fill).
- Tooltips: `Flip Horizontal`, `Flip Vertical`.
- API: `SketchTextInput.isHorizontalFlip` / `isVerticalFlip` (also on `SketchText` after create).
- Defaults: both `false`. Center constraints still required after flip; flip must not break associativity — if constraints fail after flip rebuild, hard-fail with reason.
- Live preview updates immediately on toggle.

**Angle column**

- Store degrees in the palette; convert to radians for API.
- Accept expressions when possible (`"45 deg"`, `"0.785 rad"`) via `unitsManager`.
- Default `0`. Range unrestricted in v1 (normalize display to −180…180 optional).
- Changing angle updates `setAsMultiLine` angle on rebuild; constraints keep center on the point (rotate about center).

**Center constraint (required — hard fail)**

After add, use `MultiLineTextDefinition.rectangleLines`:

1. Keep the four rectangle lines from the definition.
2. Mid-point / coincident constraints so rectangle center stays on the selected `SketchPoint`.
3. **No soft fallback.** If `rectangleLines` is missing, constraint creation throws, or the center is not associatively tied to the point → **hard fail** that row (and abort the whole OK transaction). Roll back any geometry created for that attempt. **Always report why** it failed (see Error reporting below). Preview: drop that rebuild and surface the error; do not leave unconstrained text in the sketch.

**Error reporting (constraint failures)**

Surface a concrete reason — not only “Failed to constrain text to point”. Include:

| Field | Example |
|-------|---------|
| Row / point | `Row 2` / sketch point name or index |
| Stage | e.g. `rectangleLines unavailable`, `midPoint constraint`, `coincident to sketch point`, `verify associativity` |
| API / exception detail | Fusion `RuntimeError` / return code / message when present |
| Hint (optional) | Short next step if known (`Sketch locked`, `Point from different sketch`, …) |

Formats:

- Palette status (preview):  
  `Constraint failed — Row 2: rectangleLines unavailable (MultiLineTextDefinition returned empty).`
- OK `messageBox` / log: same text, plus full traceback in Text Commands / add-in log when an exception was thrown.

Raise a dedicated error type (e.g. `TextConstraintError(stage, detail, row_id)`) from `text_on_point.py` so preview and execute share one message path.

### 3. Extrude

```python
ext_in = extrudes.createInput(
    sk_text,
    adsk.fusion.FeatureOperations.CutFeatureOperation  # or NewBodyFeatureOperation
)
ext_in.setDistanceExtent(False, adsk.core.ValueInput.createByReal(dist_cm))
if op == Cut and target_bodies:
    ext_in.participantBodies = target_bodies
extrudes.add(ext_in)
```

| Operation | FeatureOperations | Target body |
|-----------|-------------------|-------------|
| Cut | `CutFeatureOperation` | Optional `participantBodies` |
| New Body | `NewBodyFeatureOperation` | Hidden |

Commit: one timeline group **Engraving Text on Point**.

### 4. Fonts

Discover + seed common set; invalid → `Arial` + status toast.

### 5. Units

Internal cm / radians. Palette shows design length units and degrees for angle.

---

## Architecture

```
EngravingTextOnPoint/
  EngravingTextOnPoint.py
  EngravingTextOnPoint.manifest
  commands/
    engraving_text_command.py      # created / preview / execute / destroy
    selection_handlers.py
  lib/
    text_on_point.py               # create text + angle + center constraints
    extrude_text.py
    preview_session.py             # preview cadence, teardown, debounce keys
    batch_sequence.py
    fonts.py
    settings.py
    fusion_util.py
  resources/palette/…  resources/icons/…
  settings.json
docs/
  PLAN.md | UI_SPEC.md | API_NOTES.md
```

### Palette ↔ Python bridge

| Direction | Action | Payload |
|-----------|--------|---------|
| JS → Python | `rowUpdated` | `{ id, text, height, angle, font, flipH, flipV, justify, align }` |
| JS → Python | `batchChanged` | `{ enabled, prefix, suffix, start, digits, step }` |
| JS → Python | `optionsChanged` | `{ operation, distance, direction, theme, livePreview }` |
| JS → Python | `execute` / `cancel` | — |
| Python → JS | `setRows` | `[{ id, text, height, angle, font, flipH, flipV, justify, align, pointLabel }]` |
| Python → JS | `setFonts` / `setTheme` / `setStatus` / `setTargetEnabled` | … |

Any geometry-affecting message schedules a preview refresh (if live preview on).

### Command pattern

1. Toolbar → start command + show palette + arm selection.
2. Selection / palette edits → `executePreview` rebuild.
3. OK → `execute` commit + timeline group + hide palette.
4. Cancel / destroy → teardown; zero leftover entities.

---

## Edge cases & validation

- No points → OK disabled; preview empty.
- Empty text / height ≤ 0 → block OK; clear that row’s preview.
- Invalid angle expression → status error; keep last good preview.
- **Center constraint failure → hard fail** (no unconstrained placement). Preview/OK show **why** (stage + API detail + row); OK aborts and rolls back the full transaction.
- Cut with no intersection → text-only preview + warning; OK still attempts and rolls back on hard failure.
- Mixed components → features in each point’s component.
- Live preview off → OK builds everything in `execute` only.
- Debounce: rapid typing must not stack overlapping builds (single-flight flag in `PreviewSession`).

---

## Implementation phases

### Phase 0 — Scaffold (current)
- Manifest, palette shell (incl. Angle + Flip columns), light-default CSS, settings.
- Flip icon slots wired for stock Fusion glyphs.

### Phase 1 — Selection + table
- Multi point → rows; Text / Height / **Angle** / **Flip** / **Justify** / **Align** / Font; batch; font preview on text input.
- Stock Fusion icons for flip + justify + align groups.

### Phase 2 — Geometry + live preview (New Body)
- Builder: text + angle + flip + justify + align + center constraints + extrude New Body.
- `PreviewSession` + `executePreview`; cancel teardown.
- Live preview checkbox.

### Phase 3 — Cut + target body
- Body selection, `participantBodies`, distance/direction in preview and commit.

### Phase 4 — Polish
- Auto theme, settings persistence, icons, error UX, README install.

---

## Testing checklist

- [ ] Light theme default on first launch
- [ ] Dark and Auto follow / override correctly
- [ ] Angle column: `0`, `45`, `-90` rotate about point center in preview and commit
- [ ] Flip H / Flip V toggles use stock Fusion icons; preview and commit match
- [ ] Justify L/C/R and Align T/M/B use stock Fusion icons; preview and commit match
- [ ] Non-center justify/align still keeps rectangle center constrained to the point
- [ ] Flip + angle + align together; center constraint still holds (point drag moves text)
- [ ] Moving the sketch point after OK moves the text (constraints hold)
- [ ] Simulated / real constraint failure → hard fail, no leftover unconstrained text, status/message includes failure reason (stage + detail)
- [ ] Live preview updates on text/height/font/angle/distance edits (debounced)
- [ ] Cancel / close leaves no sketch text or extrudes
- [ ] Live preview off → no geometry until OK
- [ ] Single point → centered text → New Body
- [ ] Multi-point batch sequence order matches selection
- [ ] Font dropdown + text input face
- [ ] Cut with / without explicit target body
- [ ] Undo reverses entire engraving group after OK

---

## Decisions

| Topic | Decision |
|-------|----------|
| Join operation | Defer; Cut + New Body only |
| **Text angle** | **Per-row Angle column (degrees); default 0** |
| **Text flip** | **Per-row H + V toggles; stock Fusion flip icons; default off** |
| **Justify / Align** | **Per-row H (L/C/R) + V (T/M/B); stock Fusion align icons; default Center / Middle** |
| Sketch creation | Always use **existing** sketch of selected point |
| **Preview** | **Live preview on by default via executePreview; teardown on cancel** |
| Default height | `3 mm` |
| Default font | `Arial` |
| Default distance | `1 mm` |
| Default angle | `0 deg` |
| Default flip H/V | `false` / `false` |
| Default justify / align | `center` / `middle` |
| Default theme | `light` |

---

## Success criteria

1. Stock-like table palette with Fusion icons where possible.
2. Text centered and **associatively constrained** to each selected sketch point, at the row’s angle; constraint failure is a **hard fail** that **reports why** (no unconstrained fallback).
3. Extrude Cut or New Body with optional target body for Cut.
4. Batch sequential text with prefix/suffix.
5. Font-aware text field + font dropdown + **angle**, **flip**, **justify**, and **align** (stock Fusion icons).
6. **Live preview** with clean cancel/destroy teardown.
7. Light / Dark / Auto themes; **Light default**.
