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

  function iconToggle(label, pressed, title, dataKey) {
    return (
      '<button type="button" class="icon-btn format-btn" data-key="' +
      dataKey +
      '" aria-pressed="' +
      (pressed ? "true" : "false") +
      '" title="' +
      title +
      '">' +
      label +
      "</button>"
    );
  }

  function iconRadio(label, checked, title, dataKey, dataVal) {
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
      label +
      "</button>"
    );
  }

  /** One column: Flip (H/V) + Justify (3) + Align (3). Active = darkened. */
  function formatCellHtml(row) {
    return (
      '<span class="format-cell" aria-label="Flip justify align">' +
      '<span class="icon-group" data-group="flip" title="Flip">' +
      iconToggle("H", row.flipH, "Flip horizontal", "flipH") +
      iconToggle("V", row.flipV, "Flip vertical", "flipV") +
      "</span>" +
      '<span class="icon-group" role="radiogroup" data-group="justify" title="Justify">' +
      iconRadio("L", row.justify === "left", "Justify left", "justify", "left") +
      iconRadio(
        "C",
        row.justify === "center",
        "Justify center",
        "justify",
        "center"
      ) +
      iconRadio(
        "R",
        row.justify === "right",
        "Justify right",
        "justify",
        "right"
      ) +
      "</span>" +
      '<span class="icon-group" role="radiogroup" data-group="align" title="Align">' +
      iconRadio("T", row.align === "top", "Align top", "align", "top") +
      iconRadio(
        "M",
        row.align === "middle",
        "Align middle",
        "align",
        "middle"
      ) +
      iconRadio(
        "B",
        row.align === "bottom",
        "Align bottom",
        "align",
        "bottom"
      ) +
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
          '<td class="col-text"><input type="text" class="row-text" value="' +
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
          '<td class="col-font"><select class="row-font">' +
          fontOptions(row.font) +
          "</select></td>" +
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

    tbody.querySelectorAll(".format-btn").forEach(function (btn) {
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
        var textInput = tr && tr.querySelector(".row-text");
        if (textInput) textInput.style.fontFamily = sel.value;
      });
    });
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
