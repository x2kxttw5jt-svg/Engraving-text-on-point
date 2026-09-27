/**
 * Palette shell — theme + batch UI only.
 * Fusion bridge (adsk.fusionSendData) is wired in Phase 1.
 *
 * Rule: unavailable controls stay hidden (not greyed/disabled)
 * until their use conditions are met.
 */
(function () {
  const themeSelect = document.getElementById("theme");
  const batchEnabled = document.getElementById("batch-enabled");
  const batchGrid = document.getElementById("batch-grid");
  const batchPrefix = document.getElementById("batch-prefix");
  const batchSuffix = document.getElementById("batch-suffix");
  const batchStart = document.getElementById("batch-start");
  const batchDigits = document.getElementById("batch-digits");
  const batchStep = document.getElementById("batch-step");
  const batchExample = document.getElementById("batch-example");
  const solidPreview = document.getElementById("solid-preview");
  const statusEl = document.getElementById("status");
  const manipStatus = document.getElementById("manip-status");
  const btnAddPoint = document.getElementById("btn-add-point");
  const btnOrient = document.getElementById("btn-orient");
  const orientLabel = document.getElementById("orient-label");
  const btnRef = document.getElementById("btn-ref");
  const refLabel = document.getElementById("ref-label");
  const pointsCount = document.getElementById("points-count");
  const targetRow = document.getElementById("target-row");
  const btnOk = document.getElementById("btn-ok");
  const btnApply = document.getElementById("btn-apply");
  const btnCancel = document.getElementById("btn-cancel");
  const thPlace = document.getElementById("th-place");
  const tbody = document.getElementById("text-tbody");
  const opDropdown = document.getElementById("op-dropdown");
  const opTrigger = document.getElementById("op-trigger");
  const opMenu = document.getElementById("op-menu");
  const opHidden = document.getElementById("operation");
  const opTriggerIcon = document.getElementById("op-trigger-icon");
  const opTriggerLabel = document.getElementById("op-trigger-label");

  const FONTS = ["Arial", "Artifakt Element", "Courier New", "Times New Roman"];
  const OP_LABELS = {
    join: "Join",
    cut: "Cut",
    intersect: "Intersect",
    newBody: "New Body",
  };
  const OP_ICON_CLASS = {
    join: "op-icon-join",
    cut: "op-icon-cut",
    intersect: "op-icon-intersect",
    newBody: "op-icon-newbody",
  };
  // Boolean ops need a target body; New Body does not. New Component excluded.
  const OPS_NEED_TARGET = { join: true, cut: true, intersect: true };

  let mockOrient = false;
  let mockRef = false;
  let mockRefDims = false;
  let activeRowId = null;
  let rows = [];

  function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = !!hidden;
  }

  /** Position cell: Pos X/Y when Ref set; Angle when Orientation set. */
  function syncPlacementVisibility() {
    var showCol = mockRefDims || mockOrient;
    setHidden(thPlace, !showCol);
    document.querySelectorAll(".cell-place").forEach(function (td) {
      setHidden(td, !showCol);
    });
    document.querySelectorAll(".place-xy").forEach(function (el) {
      setHidden(el, !mockRefDims);
    });
    document.querySelectorAll(".place-angle").forEach(function (el) {
      setHidden(el, !mockOrient);
    });
  }

  function syncCommitVisibility() {
    var ready = rows.length >= 1;
    setHidden(btnOk, !ready);
    setHidden(btnApply, !ready);
  }

  function batchTextAt(index) {
    var prefix = (batchPrefix && batchPrefix.value) || "";
    var suffix = (batchSuffix && batchSuffix.value) || "";
    var start = parseInt(batchStart && batchStart.value, 10);
    var digits = parseInt(batchDigits && batchDigits.value, 10);
    var step = parseInt(batchStep && batchStep.value, 10);
    if (isNaN(start)) start = 1;
    if (isNaN(digits) || digits < 1) digits = 3;
    if (isNaN(step)) step = 1;
    var n = start + index * step;
    var num = String(Math.abs(n));
    while (num.length < digits) num = "0" + num;
    if (n < 0) num = "-" + num;
    return prefix + num + suffix;
  }

  function syncBatchExample() {
    if (batchExample) batchExample.textContent = batchTextAt(0);
  }

  /** When Batch is on, rewrite non-overridden row texts from the formula. */
  function applyBatchToRows(forceAll) {
    if (!batchEnabled || !batchEnabled.checked) return;
    rows.forEach(function (row, i) {
      if (!forceAll && row.batchOverride) return;
      row.text = batchTextAt(i);
      if (forceAll) row.batchOverride = false;
    });
    syncBatchExample();
    renderRows();
  }

  /** Selecting Ref auto-applies H/V dims to free (unconstrained) rows — no Apply button. */
  function applyRefDimsToFreeRows() {
    mockRefDims = true;
    rows.forEach(function (row, i) {
      if (row.xyConstrained) return;
      if (!row.dx || row.dx === "0 mm" || row.dx === "—") {
        row.dx = 10 + i * 8 + " mm";
      }
      if (!row.dy || row.dy === "0 mm" || row.dy === "—") {
        row.dy = "5 mm";
      }
    });
  }

  function currentOperation() {
    return (opHidden && opHidden.value) || "cut";
  }

  function syncTargetVisibility() {
    setHidden(targetRow, !OPS_NEED_TARGET[currentOperation()]);
  }

  function setOperation(op) {
    if (!OP_LABELS[op]) return;
    if (opHidden) opHidden.value = op;
    if (opTrigger) opTrigger.setAttribute("data-op", op);
    if (opTriggerLabel) opTriggerLabel.textContent = OP_LABELS[op];
    if (opTriggerIcon) {
      opTriggerIcon.className = "op-icon " + OP_ICON_CLASS[op];
    }
    if (opMenu) {
      opMenu.querySelectorAll('[role="option"]').forEach(function (li) {
        li.setAttribute(
          "aria-selected",
          li.getAttribute("data-op") === op ? "true" : "false"
        );
      });
    }
    syncTargetVisibility();
    if (statusEl) {
      statusEl.textContent =
        "Operation → " +
        OP_LABELS[op] +
        (OPS_NEED_TARGET[op]
          ? " (Target Body shown)"
          : " (no target body)") +
        " — dummy UI";
    }
  }

  function closeOpMenu() {
    if (!opMenu || !opTrigger || !opDropdown) return;
    opMenu.hidden = true;
    opTrigger.setAttribute("aria-expanded", "false");
    opDropdown.classList.remove("is-open");
  }

  function openOpMenu() {
    if (!opMenu || !opTrigger || !opDropdown) return;
    opMenu.hidden = false;
    opTrigger.setAttribute("aria-expanded", "true");
    opDropdown.classList.add("is-open");
  }

  if (opTrigger && opMenu) {
    opTrigger.addEventListener("click", function (e) {
      e.stopPropagation();
      if (opMenu.hidden) openOpMenu();
      else closeOpMenu();
    });
    opMenu.querySelectorAll('[role="option"]').forEach(function (li) {
      li.addEventListener("click", function (e) {
        e.stopPropagation();
        setOperation(li.getAttribute("data-op"));
        closeOpMenu();
      });
    });
    document.addEventListener("click", function () {
      closeOpMenu();
    });
  }

  function syncPointsCount() {
    if (pointsCount) {
      pointsCount.textContent = rows.length + " selected";
    }
  }

  // Fusion Sketch Text–style glyphs (dummy stand-ins; swap for stock PNGs later).
  var ICONS = {
    flipH:
      '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 3 L8 13 L2 13 Z" fill="#0696D7"/><path d="M14 3 L8 13 L14 13 Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
    flipV:
      '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2 L13 8 L3 14 Z" fill="#0696D7"/><path d="M13 2 L13 14 L3 8 Z" stroke="currentColor" stroke-width="1.2" fill="none"/></svg>',
    justifyLeft:
      '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M3 3.5 H13 M3 6.5 H9 M3 9.5 H12 M3 12.5 H8" fill="none"/></svg>',
    justifyCenter:
      '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M3 3.5 H13 M5 6.5 H11 M3.5 9.5 H12.5 M6 12.5 H10" fill="none"/></svg>',
    justifyRight:
      '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M3 3.5 H13 M7 6.5 H13 M4 9.5 H13 M8 12.5 H13" fill="none"/></svg>',
    alignTop:
      '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M2.5 3 H13.5"/><rect x="4" y="5" width="3.2" height="8" rx="0.4" fill="currentColor"/><rect x="8.8" y="5" width="3.2" height="5.5" rx="0.4" fill="currentColor"/></svg>',
    alignMiddle:
      '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M2.5 8 H13.5"/><rect x="4" y="3.5" width="3.2" height="9" rx="0.4" fill="currentColor"/><rect x="8.8" y="5" width="3.2" height="6" rx="0.4" fill="currentColor"/></svg>',
    alignBottom:
      '<svg class="glyph" viewBox="0 0 16 16" aria-hidden="true"><path stroke="currentColor" stroke-width="1.4" stroke-linecap="round" d="M2.5 13 H13.5"/><rect x="4" y="3" width="3.2" height="8" rx="0.4" fill="currentColor"/><rect x="8.8" y="5.5" width="3.2" height="5.5" rx="0.4" fill="currentColor"/></svg>',
  };

  function iconToggle(iconKey, pressed, title, dataKey) {
    return (
      '<button type="button" class="icon-btn format-btn" data-key="' +
      dataKey +
      '" aria-pressed="' +
      (pressed ? "true" : "false") +
      '" title="' +
      title +
      '">' +
      ICONS[iconKey] +
      "</button>"
    );
  }

  function iconRadio(iconKey, checked, title, dataKey, dataVal) {
    return (
      '<button type="button" class="icon-btn format-btn" data-key="' +
      dataKey +
      '" data-val="' +
      dataVal +
      '" aria-checked="' +
      (checked ? "true" : "false") +
      '" role="radio" title="' +
      title +
      '">' +
      ICONS[iconKey] +
      "</button>"
    );
  }

  /**
   * Format cell — Fusion Sketch Text feel:
   *   row 1: Flip H | Flip V
   *   row 2: Justify L | C | R
   *   row 3: Align T | M | B
   * Active = accent blue border (not greyed).
   */
  function formatCellHtml(row) {
    return (
      '<span class="format-cell" aria-label="Flip justify align">' +
      '<span class="icon-group icon-group-flip" data-group="flip" title="Flip">' +
      iconToggle("flipH", row.flipH, "Flip horizontal", "flipH") +
      iconToggle("flipV", row.flipV, "Flip vertical", "flipV") +
      "</span>" +
      '<span class="format-align-stack" title="Justify / Align">' +
      '<span class="icon-group" role="radiogroup" data-group="justify">' +
      iconRadio(
        "justifyLeft",
        row.justify === "left",
        "Justify left",
        "justify",
        "left"
      ) +
      iconRadio(
        "justifyCenter",
        row.justify === "center",
        "Justify center",
        "justify",
        "center"
      ) +
      iconRadio(
        "justifyRight",
        row.justify === "right",
        "Justify right",
        "justify",
        "right"
      ) +
      "</span>" +
      '<span class="icon-group" role="radiogroup" data-group="align">' +
      iconRadio("alignTop", row.align === "top", "Align top", "align", "top") +
      iconRadio(
        "alignMiddle",
        row.align === "middle",
        "Align middle",
        "align",
        "middle"
      ) +
      iconRadio(
        "alignBottom",
        row.align === "bottom",
        "Align bottom",
        "align",
        "bottom"
      ) +
      "</span>" +
      "</span>" +
      "</span>"
    );
  }

  function fontOptions(selected) {
    return FONTS.map(function (f) {
      return (
        '<option value="' +
        f +
        '" style="font-family:' +
        f +
        '"' +
        (f === selected ? " selected" : "") +
        ">" +
        f +
        "</option>"
      );
    }).join("");
  }

  /**
   * Position cell: Pos X / Pos Y stacked, Angle below.
   * Pos X/Y greyed when point already constrained; fields hide until Ref / Orientation.
   */
  function placeCellHtml(row) {
    var locked = !!row.xyConstrained;
    var showCol = mockRefDims || mockOrient;
    var xyTitle = locked
      ? "Point is constrained — XY placement locked"
      : "Offset from Ref";
    var lockCls = locked ? " is-xy-locked" : "";
    var lockAttr = locked ? " disabled" : "";
    return (
      '<td class="col-place cell-place"' +
      (showCol ? "" : " hidden") +
      ">" +
      '<div class="place-stack">' +
      '<div class="place-xy place-xy-pair"' +
      (mockRefDims ? "" : " hidden") +
      ">" +
      '<label class="place-row"><span class="place-key">Pos X</span>' +
      '<input type="text" class="row-dx' +
      lockCls +
      '" value="' +
      escapeHtml(row.dx) +
      '" title="' +
      xyTitle +
      '"' +
      lockAttr +
      " /></label>" +
      '<label class="place-row"><span class="place-key">Pos Y</span>' +
      '<input type="text" class="row-dy' +
      lockCls +
      '" value="' +
      escapeHtml(row.dy) +
      '" title="' +
      xyTitle +
      '"' +
      lockAttr +
      " /></label>" +
      "</div>" +
      '<label class="place-angle place-row"' +
      (mockOrient ? "" : " hidden") +
      '><span class="place-key">Angle</span>' +
      '<input type="text" class="row-angle" value="' +
      escapeHtml(row.angle) +
      '" title="Rotation vs Orientation" /></label>' +
      "</div></td>"
    );
  }

  function textCellHtml(row) {
    var styleCls =
      (row.bold ? " is-bold" : "") + (row.italic ? " is-italic" : "");
    var fontStyle = ' style="font-family:' + (row.font || "Arial") + '"';
    // Batch drives Text — no per-row input field.
    if (batchEnabled && batchEnabled.checked) {
      return (
        '<td class="col-text">' +
        '<span class="row-text-display' +
        styleCls +
        '"' +
        fontStyle +
        ' title="Driven by Batch sequence">' +
        escapeHtml(row.text) +
        "</span></td>"
      );
    }
    return (
      '<td class="col-text"><textarea class="row-text' +
      styleCls +
      '" rows="1"' +
      fontStyle +
      ">" +
      escapeHtml(row.text) +
      "</textarea></td>"
    );
  }

  function renderRows() {
    if (!tbody) return;
    if (!rows.length) {
      tbody.innerHTML =
        '<tr class="empty"><td colspan="7">Select sketch points to add rows</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (row, i) {
        var active = row.id === activeRowId ? " is-active" : "";
        return (
          '<tr class="data-row' +
          active +
          '" data-id="' +
          row.id +
          '">' +
          '<td class="col-idx">' +
          (i + 1) +
          "</td>" +
          textCellHtml(row) +
          '<td class="col-ht"><input type="text" class="row-ht" value="' +
          row.height +
          '" /></td>' +
          placeCellHtml(row) +
          '<td class="col-format">' +
          formatCellHtml(row) +
          "</td>" +
          '<td class="col-font">' +
          fontCellHtml(row) +
          "</td>" +
          '<td class="col-resize" aria-hidden="true"><span class="row-resize-handle" title="Drag to resize row"></span></td>' +
          "</tr>"
        );
      })
      .join("");

    tbody.querySelectorAll(".data-row").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        if (e.target.closest("button, input, select, textarea")) return;
        activeRowId = tr.getAttribute("data-id");
        renderRows();
      });
    });

    tbody.querySelectorAll("textarea.row-text").forEach(function (ta) {
      autosizeTextarea(ta);
      ta.addEventListener("input", function () {
        var tr = ta.closest("tr");
        var id = tr && tr.getAttribute("data-id");
        var row = rows.find(function (r) {
          return r.id === id;
        });
        if (row) row.text = ta.value;
        autosizeTextarea(ta);
      });
    });

    bindRowResizeHandles();

    tbody.querySelectorAll(".format-btn, .style-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var tr = btn.closest("tr");
        var id = tr && tr.getAttribute("data-id");
        var row = rows.find(function (r) {
          return r.id === id;
        });
        if (!row) return;
        var key = btn.getAttribute("data-key");
        if (btn.getAttribute("aria-pressed") !== null) {
          row[key] = btn.getAttribute("aria-pressed") !== "true";
          renderRows();
          return;
        }
        var val = btn.getAttribute("data-val");
        if (key && val) {
          row[key] = val;
          renderRows();
        }
      });
    });

    tbody.querySelectorAll(".row-font").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var tr = sel.closest("tr");
        var id = tr && tr.getAttribute("data-id");
        var row = rows.find(function (r) {
          return r.id === id;
        });
        if (!row) return;
        row.font = sel.value;
        applyTextPreview(tr, row);
      });
    });

    bindPlacementInputs();
  }

  function rowFromEl(el) {
    var tr = el && el.closest("tr");
    var id = tr && tr.getAttribute("data-id");
    return rows.find(function (r) {
      return r.id === id;
    });
  }

  function bindPlacementInputs() {
    [
      { sel: ".row-dx", key: "dx", label: "Pos X", xyOnly: true },
      { sel: ".row-dy", key: "dy", label: "Pos Y", xyOnly: true },
      { sel: ".row-angle", key: "angle", label: "Angle" },
      { sel: ".row-ht", key: "height", label: "Ht" },
    ].forEach(function (spec) {
      tbody.querySelectorAll(spec.sel).forEach(function (inp) {
        inp.addEventListener("change", function () {
          var row = rowFromEl(inp);
          if (!row) return;
          if (spec.xyOnly && row.xyConstrained) return;
          row[spec.key] = inp.value;
          if (statusEl) {
            statusEl.textContent =
              "Would set " +
              spec.label +
              " from table and sync triad — dummy UI (" +
              inp.value +
              ")";
          }
        });
      });
    });
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function autosizeTextarea(ta) {
    if (!ta) return;
    ta.style.height = "auto";
    var next = Math.max(24, ta.scrollHeight);
    var tr = ta.closest("tr");
    var minH = tr && parseInt(tr.style.minHeight || tr.dataset.minHeight || "0", 10);
    if (minH && next < minH - 8) next = minH - 8;
    ta.style.height = next + "px";
  }

  /** Drag handle on each row — resize row height; text area grows with it. */
  function bindRowResizeHandles() {
    tbody.querySelectorAll(".row-resize-handle").forEach(function (handle) {
      handle.addEventListener("mousedown", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var tr = handle.closest("tr");
        if (!tr) return;
        var startY = e.clientY;
        var startH = tr.getBoundingClientRect().height;
        function onMove(ev) {
          var h = Math.max(36, startH + (ev.clientY - startY));
          tr.style.height = h + "px";
          tr.dataset.minHeight = String(h);
          var ta = tr.querySelector("textarea.row-text");
          if (ta) {
            ta.style.minHeight = Math.max(24, h - 12) + "px";
          }
        }
        function onUp() {
          document.removeEventListener("mousemove", onMove);
          document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
      });
    });
  }

  /** Mirror Font / Bold / Italic onto the Text cell (same live preview as font). */
  function applyTextPreview(tr, row) {
    var textInput = tr && tr.querySelector(".row-text");
    if (!textInput || !row) return;
    textInput.style.fontFamily = row.font || "Arial";
    textInput.classList.toggle("is-bold", !!row.bold);
    textInput.classList.toggle("is-italic", !!row.italic);
    if (textInput.tagName === "TEXTAREA") autosizeTextarea(textInput);
  }

  function fontCellHtml(row) {
    // Font on top; B and I side-by-side underneath.
    return (
      '<div class="font-stack">' +
      '<select class="row-font" title="Font">' +
      fontOptions(row.font) +
      "</select>" +
      '<div class="font-style-row">' +
      '<button type="button" class="icon-btn style-btn" data-key="bold" aria-pressed="' +
      (row.bold ? "true" : "false") +
      '" title="Bold">B</button>' +
      '<button type="button" class="icon-btn style-btn" data-key="italic" aria-pressed="' +
      (row.italic ? "true" : "false") +
      '" title="Italic">I</button>' +
      "</div>" +
      "</div>"
    );
  }

  function addRow(partial) {
    var id = "r" + (rows.length + 1) + "-" + Date.now().toString(36);
    var row = Object.assign(
      {
        id: id,
        text: "PN-001",
        height: "3 mm",
        dx: "0 mm",
        dy: "0 mm",
        xyConstrained: false,
        angle: "0 deg",
        flipH: false,
        flipV: false,
        justify: "center",
        align: "middle",
        bold: false,
        italic: false,
        font: "Arial",
        batchOverride: false,
      },
      partial || {}
    );
    rows.push(row);
    activeRowId = row.id;
    if (mockRef) applyRefDimsToFreeRows();
    if (batchEnabled && batchEnabled.checked) {
      row.text = batchTextAt(rows.length - 1);
      row.batchOverride = false;
    }
    syncPointsCount();
    syncCommitVisibility();
    renderRows();
  }

  function seedSampleRows() {
    mockOrient = true;
    mockRef = true;
    mockRefDims = true;

    if (orientLabel) orientLabel.textContent = "XY construction (all rows)";
    if (refLabel) refLabel.textContent = "Origin (sample)";

    rows = [];
    addRow({
      text: "PN-001",
      height: "3 mm",
      dx: "12 mm",
      dy: "5 mm",
      xyConstrained: false,
      angle: "0 deg",
      justify: "center",
      align: "middle",
      bold: false,
      italic: false,
      font: "Arial",
    });
    addRow({
      text: "PN-002",
      height: "4 mm",
      dx: "28 mm",
      dy: "5 mm",
      xyConstrained: false,
      angle: "15 deg",
      flipH: true,
      justify: "left",
      align: "middle",
      bold: true,
      italic: false,
      font: "Artifakt Element",
    });
    addRow({
      text: "REV A",
      height: "2.5 mm",
      dx: "—",
      dy: "—",
      xyConstrained: true,
      angle: "-5 deg",
      flipV: true,
      justify: "center",
      align: "top",
      bold: false,
      italic: true,
      font: "Courier New",
    });
    activeRowId = rows[0].id;
    syncPlacementVisibility();
    renderRows();

    if (manipStatus) {
      manipStatus.textContent =
        "Manipulators: Angle dim ✓ · Move ✓ · Scale→Ht ✓ (sample row 1)";
    }
    if (statusEl) {
      statusEl.textContent =
        "Sample points loaded for UI review — dummy UI (not Fusion geometry)";
    }
  }

  if (btnRef) {
    btnRef.addEventListener("click", function () {
      mockRef = !mockRef;
      if (!mockRef) {
        mockRefDims = false;
        if (refLabel) refLabel.textContent = "Auto-applies Pos X/Y to free pts";
        syncPlacementVisibility();
        renderRows();
        if (statusEl) statusEl.textContent = "Ref cleared — Pos X/Y hidden — dummy UI";
        return;
      }
      if (refLabel) refLabel.textContent = "Origin (auto-applied)";
      applyRefDimsToFreeRows();
      syncPlacementVisibility();
      renderRows();
      if (statusEl) {
        statusEl.textContent =
          "Ref selected — Pos X/Y auto-applied to free points (constrained greyed) — dummy UI";
      }
    });
  }

  function mockTriadSettled(dx, dy, angle) {
    var row = rows.find(function (r) {
      return r.id === activeRowId;
    });
    if (mockRef && row && !row.xyConstrained) {
      mockRefDims = true;
      row.dx = dx;
      row.dy = dy;
    }
    if (mockOrient && row) {
      row.angle = angle;
    }
    syncPlacementVisibility();
    renderRows();
    if (statusEl) {
      statusEl.textContent =
        "Would auto-apply Ref dims to driving (after debounce), sync table Pos X/Y/Angle, reset scale factor, then doExecutePreview — dummy UI (Pos X=" +
        dx +
        ", Pos Y=" +
        dy +
        ", Angle=" +
        angle +
        ", Ht via unified scale)";
    }
  }

  if (btnOrient) {
    btnOrient.addEventListener("click", function () {
      mockOrient = true;
      if (orientLabel) orientLabel.textContent = "Mock vector (all rows)";
      rows.forEach(function (row) {
        if (!row.angle) row.angle = "0 deg";
      });
      syncPlacementVisibility();
      renderRows();
      if (manipStatus) {
        manipStatus.textContent =
          "Manipulators: Angle dim ✓ · Move ✓ · Scale→Ht ✓";
      }
      if (statusEl) {
        statusEl.textContent =
          "Global Orientation applies to every table row — Angle shown — dummy UI";
      }
    });
  }

  if (manipStatus) {
    manipStatus.style.cursor = "pointer";
    manipStatus.title =
      "Click to mock debounce → auto-apply driving / scale→Ht → preview";
    manipStatus.addEventListener("click", function () {
      mockTriadSettled(
        mockRef ? "12 mm" : "—",
        mockRef ? "5 mm" : "—",
        mockOrient ? "15 deg" : "—"
      );
      if (statusEl && !mockRef && !mockOrient) {
        statusEl.textContent =
          "Would set heightParameter from triad unified scale (×1.2 → 3.6 mm), reset factor to 1.0, then doExecutePreview — dummy UI";
      }
    });
  }

  if (btnAddPoint) {
    btnAddPoint.addEventListener("click", function () {
      var n = rows.length + 1;
      addRow({
        text: "PN-" + String(n).padStart(3, "0"),
      });
      if (statusEl) {
        statusEl.textContent =
          "Would place point via preselect + custom-graphics projection ghost — dummy UI";
      }
      if (manipStatus) {
        manipStatus.textContent =
          "Manipulators: Angle ✓ · Move ✓ · Scale→Ht ✓";
      }
    });
  }

  var btnPoints = document.getElementById("btn-points");
  if (btnPoints) {
    btnPoints.addEventListener("click", function () {
      var n = rows.length + 1;
      addRow({
        text: "PT-" + String(n).padStart(3, "0"),
      });
      if (statusEl) {
        statusEl.textContent = "Mock point selection — dummy UI";
      }
    });
  }

  function applyTheme(mode) {
    let resolved = mode;
    if (mode === "auto") {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      resolved = prefersDark ? "dark" : "light";
    }
    document.documentElement.setAttribute("data-theme", resolved);
  }

  applyTheme(themeSelect.value || "light");

  themeSelect.addEventListener("change", function () {
    applyTheme(themeSelect.value);
  });

  function resetSessionUi(keepExtrudeSettings) {
    rows = [];
    activeRowId = null;
    mockOrient = false;
    mockRef = false;
    mockRefDims = false;
    if (orientLabel) orientLabel.textContent = "Applies to all rows";
    if (refLabel) refLabel.textContent = "Auto-applies Pos X/Y to free pts";
    if (pointsCount) pointsCount.textContent = "0 selected";
    if (batchEnabled) {
      batchEnabled.checked = false;
      if (batchGrid) batchGrid.hidden = true;
    }
    if (!keepExtrudeSettings) {
      setOperation("cut");
      var depth = document.getElementById("depth");
      var direction = document.getElementById("direction");
      if (depth) depth.value = "1 mm";
      if (direction) direction.value = "positive";
    }
    if (manipStatus) {
      manipStatus.textContent =
        "Angle dim (needs Orientation) · Move · Scale→Ht";
    }
    syncPlacementVisibility();
    syncCommitVisibility();
    syncTargetVisibility();
    renderRows();
  }

  function mockExecuteCommit(mode) {
    var n = rows.length;
    if (n < 1) return;
    if (mode === "ok") {
      if (statusEl) {
        statusEl.textContent =
          "Would execute commit (" +
          n +
          " row" +
          (n === 1 ? "" : "s") +
          ") and close palette — dummy UI";
      }
      resetSessionUi(false);
      return;
    }
    if (mode === "apply") {
      if (statusEl) {
        statusEl.textContent =
          "Would execute commit (" +
          n +
          " row" +
          (n === 1 ? "" : "s") +
          "), keep palette open, reset for next — dummy UI";
      }
      resetSessionUi(true);
    }
  }

  if (batchEnabled) {
    batchEnabled.addEventListener("change", function () {
      if (batchGrid) batchGrid.hidden = !batchEnabled.checked;
      if (batchEnabled.checked) {
        applyBatchToRows(true);
        if (statusEl) {
          statusEl.textContent =
            "Batch on — Text = Prefix + number + Suffix (edit a cell to override that row) — dummy UI";
        }
      } else if (statusEl) {
        statusEl.textContent = "Batch off — Text is per-row manual — dummy UI";
      }
      syncBatchExample();
    });
  }

  ["batch-prefix", "batch-suffix", "batch-start", "batch-digits", "batch-step"].forEach(
    function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("input", function () {
        syncBatchExample();
        if (batchEnabled && batchEnabled.checked) applyBatchToRows(false);
      });
      el.addEventListener("change", function () {
        syncBatchExample();
        if (batchEnabled && batchEnabled.checked) applyBatchToRows(false);
      });
    }
  );

  if (btnOk) {
    btnOk.addEventListener("click", function () {
      mockExecuteCommit("ok");
    });
  }
  if (btnApply) {
    btnApply.addEventListener("click", function () {
      mockExecuteCommit("apply");
    });
  }
  if (btnCancel) {
    btnCancel.addEventListener("click", function () {
      if (statusEl) {
        statusEl.textContent =
          "Would cancel — discard preview geometry, close without commit — dummy UI";
      }
      resetSessionUi(false);
    });
  }

  function syncPreviewStatus() {
    if (!statusEl || rows.length) return;
    statusEl.textContent = solidPreview && solidPreview.checked
      ? ""
      : "Solid preview off — sketch still updates; OK/Apply will create solids";
  }

  if (solidPreview) {
    solidPreview.addEventListener("change", syncPreviewStatus);
  }

  // Seed sample points so the table/chrome are reviewable on open.
  seedSampleRows();
  setOperation("cut");
  syncPlacementVisibility();
  syncCommitVisibility();
  syncBatchExample();
  if (statusEl) {
    statusEl.textContent =
      "Sample points loaded for UI review — dummy UI (not Fusion geometry)";
  }

  window.fusionJavaScriptHandler = {
    handle: function (action, data) {
      try {
        if (action === "setTheme") {
          const payload = typeof data === "string" ? JSON.parse(data) : data;
          if (payload.mode) {
            themeSelect.value = payload.mode;
            applyTheme(payload.mode);
          }
        }
      } catch (e) {
        return "ERROR: " + e.message;
      }
      return "OK";
    },
  };
})();
