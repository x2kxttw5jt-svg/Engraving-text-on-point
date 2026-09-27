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
  const livePreview = document.getElementById("live-preview");
  const statusEl = document.getElementById("status");
  const manipStatus = document.getElementById("manip-status");
  const btnAddPoint = document.getElementById("btn-add-point");
  const btnOrient = document.getElementById("btn-orient");
  const orientLabel = document.getElementById("orient-label");
  const btnRef = document.getElementById("btn-ref");
  const refLabel = document.getElementById("ref-label");
  const pointsCount = document.getElementById("points-count");
  const targetRow = document.getElementById("target-row");
  const btnApplyRef = document.getElementById("btn-apply-ref");
  const btnOk = document.getElementById("btn-ok");
  const frameDimsRow = document.getElementById("frame-dims-row");
  const dimDxWrap = document.getElementById("dim-dx-wrap");
  const dimDyWrap = document.getElementById("dim-dy-wrap");
  const dimAngleWrap = document.getElementById("dim-angle-wrap");
  const thAngle = document.getElementById("th-angle");
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

  function syncFrameDimsVisibility() {
    setHidden(dimDxWrap, !mockRefDims);
    setHidden(dimDyWrap, !mockRefDims);
    setHidden(dimAngleWrap, !mockOrient);
    setHidden(frameDimsRow, !(mockRefDims || mockOrient));
    setHidden(thAngle, !mockOrient);
    document.querySelectorAll(".cell-angle").forEach(function (td) {
      setHidden(td, !mockOrient);
    });
  }

  function syncApplyRefVisibility() {
    setHidden(btnApplyRef, !mockRef);
  }

  function syncOkVisibility() {
    setHidden(btnOk, rows.length < 1);
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
          '<td class="col-text"><input type="text" class="row-text' +
          (row.bold ? " is-bold" : "") +
          (row.italic ? " is-italic" : "") +
          '" value="' +
          row.text +
          '" style="font-family:' +
          row.font +
          '" /></td>' +
          '<td class="col-ht"><input type="text" class="row-ht" value="' +
          row.height +
          '" /></td>' +
          '<td class="col-angle cell-angle"' +
          (mockOrient ? "" : " hidden") +
          '><input type="text" class="row-angle" value="' +
          row.angle +
          '" /></td>' +
          '<td class="col-orient"><span class="muted">' +
          row.orient +
          "</span></td>" +
          '<td class="col-format">' +
          formatCellHtml(row) +
          "</td>" +
          '<td class="col-font">' +
          fontCellHtml(row) +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    tbody.querySelectorAll(".data-row").forEach(function (tr) {
      tr.addEventListener("click", function (e) {
        if (e.target.closest("button, input, select")) return;
        activeRowId = tr.getAttribute("data-id");
        renderRows();
      });
    });

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
  }

  /** Mirror Font / Bold / Italic onto the Text cell (same live preview as font). */
  function applyTextPreview(tr, row) {
    var textInput = tr && tr.querySelector(".row-text");
    if (!textInput || !row) return;
    textInput.style.fontFamily = row.font || "Arial";
    textInput.classList.toggle("is-bold", !!row.bold);
    textInput.classList.toggle("is-italic", !!row.italic);
  }

  function fontCellHtml(row) {
    return (
      '<span class="font-cell">' +
      '<span class="icon-group icon-group-style" title="Style">' +
      '<button type="button" class="icon-btn style-btn" data-key="bold" aria-pressed="' +
      (row.bold ? "true" : "false") +
      '" title="Bold">B</button>' +
      '<button type="button" class="icon-btn style-btn" data-key="italic" aria-pressed="' +
      (row.italic ? "true" : "false") +
      '" title="Italic">I</button>' +
      "</span>" +
      '<select class="row-font" title="Font">' +
      fontOptions(row.font) +
      "</select>" +
      "</span>"
    );
  }

  function addRow(partial) {
    var id = "r" + (rows.length + 1) + "-" + Date.now().toString(36);
    var row = Object.assign(
      {
        id: id,
        text: "PN-001",
        height: "3 mm",
        angle: "0 deg",
        orient: mockOrient ? "XY edge" : "—",
        flipH: false,
        flipV: false,
        justify: "center",
        align: "middle",
        bold: false,
        italic: false,
        font: "Arial",
      },
      partial || {}
    );
    rows.push(row);
    activeRowId = row.id;
    syncPointsCount();
    syncOkVisibility();
    renderRows();
  }

  function seedSampleRows() {
    mockOrient = true;
    mockRef = true;
    mockRefDims = true;

    if (orientLabel) orientLabel.textContent = "XY construction";
    if (refLabel) refLabel.textContent = "Origin (sample)";
    var dx = document.getElementById("dim-dx");
    var dy = document.getElementById("dim-dy");
    var ang = document.getElementById("dim-angle");
    if (dx) dx.value = "12 mm";
    if (dy) dy.value = "5 mm";
    if (ang) ang.value = "0 deg";

    rows = [];
    addRow({
      text: "PN-001",
      height: "3 mm",
      angle: "0 deg",
      orient: "XY edge",
      justify: "center",
      align: "middle",
      bold: false,
      italic: false,
      font: "Arial",
    });
    addRow({
      text: "PN-002",
      height: "4 mm",
      angle: "15 deg",
      orient: "XY edge",
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
      angle: "-5 deg",
      orient: "XY edge",
      flipV: true,
      justify: "center",
      align: "top",
      bold: false,
      italic: true,
      font: "Courier New",
    });
    activeRowId = rows[0].id;
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
      }
      if (refLabel) {
        refLabel.textContent = mockRef
          ? "Mock ref ready"
          : "New or existing free pts";
      }
      syncApplyRefVisibility();
      syncFrameDimsVisibility();
      if (statusEl) {
        statusEl.textContent = mockRef
          ? "Ref set — Apply Ref Dims shown — dummy UI"
          : "";
      }
    });
  }

  if (btnApplyRef) {
    btnApplyRef.addEventListener("click", function () {
      if (!mockRef) return;
      mockRefDims = true;
      var dx = document.getElementById("dim-dx");
      var dy = document.getElementById("dim-dy");
      if (dx && dy) {
        dx.value = "10 mm";
        dy.value = "5 mm";
      }
      syncFrameDimsVisibility();
      if (statusEl) {
        statusEl.textContent =
          "dX/dY shown — editable via GUI or triad translate — dummy UI";
      }
    });
  }

  ["dim-dx", "dim-dy", "dim-angle"].forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", function () {
      if (statusEl) {
        statusEl.textContent =
          "Would set frame dim from GUI and sync triad — dummy UI (" +
          id +
          "=" +
          el.value +
          ")";
      }
    });
  });

  function mockTriadSettled(dx, dy, angle) {
    var dxEl = document.getElementById("dim-dx");
    var dyEl = document.getElementById("dim-dy");
    var angEl = document.getElementById("dim-angle");
    if (mockRef && dxEl && dyEl) {
      mockRefDims = true;
      dxEl.value = dx;
      dyEl.value = dy;
    }
    if (mockOrient && angEl) {
      angEl.value = angle;
    }
    syncFrameDimsVisibility();
    if (statusEl) {
      statusEl.textContent =
        "Would auto-apply Ref dims to driving (after debounce), sync GUI, reset scale factor, then doExecutePreview — dummy UI (dX=" +
        dx +
        ", dY=" +
        dy +
        ", Angle=" +
        angle +
        ", Ht via unified scale)";
    }
  }

  if (btnOrient) {
    btnOrient.addEventListener("click", function () {
      mockOrient = true;
      if (orientLabel) orientLabel.textContent = "Mock vector";
      var ang = document.getElementById("dim-angle");
      if (ang) ang.value = "0 deg";
      rows.forEach(function (r) {
        if (r.orient === "—") r.orient = "Mock vector";
      });
      syncFrameDimsVisibility();
      renderRows();
      if (manipStatus) {
        manipStatus.textContent =
          "Manipulators: Angle dim ✓ · Move ✓ · Scale→Ht ✓";
      }
      if (statusEl) {
        statusEl.textContent =
          "Angle field shown — via GUI/triad rotate; Ht via GUI/triad unified scale — dummy UI";
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
        orient: mockOrient ? "XY edge" : "—",
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
        orient: mockOrient ? "XY edge" : "—",
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

  batchEnabled.addEventListener("change", function () {
    batchGrid.hidden = !batchEnabled.checked;
  });

  function syncPreviewStatus() {
    if (!statusEl || rows.length) return;
    statusEl.textContent = livePreview.checked
      ? ""
      : "Preview off — OK will create features";
  }

  livePreview.addEventListener("change", syncPreviewStatus);

  // Seed sample points so the table/chrome are reviewable on open.
  seedSampleRows();
  setOperation("cut");
  syncApplyRefVisibility();
  syncFrameDimsVisibility();
  syncOkVisibility();
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
