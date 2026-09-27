# Engraving Text on Point — Feature Plan

## Goal

A Fusion 360 Python add-in that lets the user pick sketch points, place centered sketch text on each point, then extrude that text as **Cut** or **New Body**, with an optional target body. The UI is a **stock-looking table palette** (light default, dark, auto) that supports per-row text/height/font/**angle** and **batch sequential text** with prefix/suffix. Changes show as a **live preview** in the design; Cancel/destroy removes all preview geometry.

---

## User flow

```
Toolbar button → Command starts + Palette opens
  ↓
[Point] selection (multi-select sketch points) → rows appear; live preview places text
  ↓
Edit Text / Height / Font / Angle (or Batch) → preview updates (debounced)
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

Dockable HTML palette (`adsk.core.Palettes`), width ~380–420px (angle column needs room), height flexible.

```
┌──────────────────────────────────────────────────────┐
│  Engraving Text on Point                       [?] │
├──────────────────────────────────────────────────────┤
│  ⊙ Point(s)     [ Select ]     3 selected            │
│  ⬚ Target Body  [ Select ]     (Cut only)            │
├──────────────────────────────────────────────────────┤
│  Operation   (•) Cut  ( ) New Body                   │
│  Distance    [ 1.0 mm ▼ ]                            │
│  Direction   (•) Positive  ( ) Negative              │
│  ☑ Live preview                                      │
├──────────────────────────────────────────────────────┤
│  ☐ Batch sequence                                    │
│    Prefix [PN-]  Start [1]  Digits [3]               │
│    Suffix [-A]   Step  [1]                           │
├──────────────────────────────────────────────────────┤
│  # │ Text     │ Ht   │ Angle │ Font                  │
│ ───┼──────────┼──────┼───────┼───────────────────────│
│  1 │ PN-001-A │ 3 mm │ 0 °   │ Arial ▼               │
│  2 │ PN-002-A │ 3 mm │ 45 °  │ Arial ▼               │
│  3 │ PN-003-A │ 3 mm │ 0 °   │ Courier New ▼         │
├──────────────────────────────────────────────────────┤
│  Theme  [ Light ▼ ]                                  │
│                         [ Cancel ]  [ OK ]           │
└──────────────────────────────────────────────────────┘
```

### Table columns

| Column | Control | Notes |
|--------|---------|--------|
| `#` | Read-only index | Selection order |
| Text | `<input type="text">` | Batch-driven or override; `font-family` = selected font |
| Height | Length input | Default `3 mm` |
| **Angle** | Angle input (degrees) | Default `0`; applied as `setAsMultiLine(..., angle)`; per-row |
| Font | `<select>` | Options styled in that font; drives Text input face |

Optional header control: “Apply angle to all” when user wants one angle for every row (does not remove per-row edits afterward).

### Batch sequence behavior

- Toggle **Batch sequence** on → Text column becomes driven by formula:
  - `display = prefix + str(start + i*step).zfill(digits) + suffix`
  - Example: `PN-` + `001` + `-A` → `PN-001-A`, `PN-002-A`, …
- Changing prefix/suffix/start/digits/step re-writes all non-overridden rows **and refreshes live preview**.
- Per-row “override” flag: user edits Text → that row stops auto-updating until batch is toggled off/on or “Reset batch texts” is clicked.
- Batch does **not** drive Angle (angles stay per-row unless “Apply angle to all”).
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
- Editing Text / Height / Font / Angle / Distance / Direction / Operation / Target body updates the preview.
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
angle_rad = math.radians(angle_deg)  # setAsMultiLine angle is radians
tin.setAsMultiLine(
    adsk.core.Point3D.create(cx - half_w, cy - half_h, 0),
    adsk.core.Point3D.create(cx + half_w, cy + half_h, 0),
    adsk.core.HorizontalAlignments.CenterHorizontalAlignment,
    adsk.core.VerticalAlignments.MiddleVerticalAlignment,
    angle_rad)
tin.fontName = font_name
sk_text = sketch.sketchTexts.add(tin)
```

**Angle column**

- Store degrees in the palette; convert to radians for API.
- Accept expressions when possible (`"45 deg"`, `"0.785 rad"`) via `unitsManager`.
- Default `0`. Range unrestricted in v1 (normalize display to −180…180 optional).
- Changing angle updates `setAsMultiLine` angle on rebuild; constraints keep center on the point (rotate about center).

**Center constraint (required — hard fail)**

After add, use `MultiLineTextDefinition.rectangleLines`:

1. Keep the four rectangle lines from the definition.
2. Mid-point / coincident constraints so rectangle center stays on the selected `SketchPoint`.
3. **No soft fallback.** If `rectangleLines` is missing, constraint creation throws, or the center is not associatively tied to the point → **hard fail** that row (and abort the whole OK transaction). Roll back any geometry created for that attempt; show a clear status/messageBox (`Failed to constrain text to point`). Preview: drop that rebuild and surface the error; do not leave unconstrained text in the sketch.

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
| JS → Python | `rowUpdated` | `{ id, text, height, angle, font }` |
| JS → Python | `batchChanged` | `{ enabled, prefix, suffix, start, digits, step }` |
| JS → Python | `optionsChanged` | `{ operation, distance, direction, theme, livePreview }` |
| JS → Python | `execute` / `cancel` | — |
| Python → JS | `setRows` | `[{ id, text, height, angle, font, pointLabel }]` |
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
- **Center constraint failure → hard fail** (no unconstrained placement). Preview shows error + no text for that tick; OK aborts and rolls back the full transaction.
- Cut with no intersection → text-only preview + warning; OK still attempts and rolls back on hard failure.
- Mixed components → features in each point’s component.
- Live preview off → OK builds everything in `execute` only.
- Debounce: rapid typing must not stack overlapping builds (single-flight flag in `PreviewSession`).

---

## Implementation phases

### Phase 0 — Scaffold (current)
- Manifest, palette shell (incl. Angle column), light-default CSS, settings.

### Phase 1 — Selection + table
- Multi point → rows; Text / Height / **Angle** / Font; batch; font preview on text input.

### Phase 2 — Geometry + live preview (New Body)
- Builder: text + angle + center constraints + extrude New Body.
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
- [ ] Moving the sketch point after OK moves the text (constraints hold)
- [ ] Simulated / real constraint failure → hard fail, no leftover unconstrained text
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
| Sketch creation | Always use **existing** sketch of selected point |
| **Preview** | **Live preview on by default via executePreview; teardown on cancel** |
| Default height | `3 mm` |
| Default font | `Arial` |
| Default distance | `1 mm` |
| Default angle | `0 deg` |
| Default theme | `light` |

---

## Success criteria

1. Stock-like table palette with Fusion icons where possible.
2. Text centered and **associatively constrained** to each selected sketch point, at the row’s angle; constraint failure is a **hard fail** (no unconstrained fallback).
3. Extrude Cut or New Body with optional target body for Cut.
4. Batch sequential text with prefix/suffix.
5. Font-aware text field + font dropdown + **angle column**.
6. **Live preview** with clean cancel/destroy teardown.
7. Light / Dark / Auto themes; **Light default**.
