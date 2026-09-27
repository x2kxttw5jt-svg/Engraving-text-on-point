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
  const opRadios = document.querySelectorAll('input[name="op"]');
  const targetRow = document.getElementById("target-row");
  const btnApplyRef = document.getElementById("btn-apply-ref");
  const btnOk = document.getElementById("btn-ok");
  const frameDimsRow = document.getElementById("frame-dims-row");
  const dimDxWrap = document.getElementById("dim-dx-wrap");
  const dimDyWrap = document.getElementById("dim-dy-wrap");
  const dimAngleWrap = document.getElementById("dim-angle-wrap");
  const thAngle = document.getElementById("th-angle");
  const tbody = document.getElementById("text-tbody");

  const FONTS = ["Arial", "Artifakt Element", "Courier New", "Times New Roman"];

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

  function syncTargetVisibility() {
    const op = document.querySelector('input[name="op"]:checked');
    const cut = op && op.value === "cut";
    setHidden(targetRow, !cut);
  }

  function syncPointsCount() {
    if (pointsCount) {
      pointsCount.textContent = rows.length + " selected";
    }
  }

  function iconToggle(label, pressed, title) {
    return (
      '<button type="button" class="icon-btn" aria-pressed="' +
      (pressed ? "true" : "false") +
      '" title="' +
      title +
      '">' +
      label +
      "</button>"
    );
  }

  function iconRadio(label, checked, title) {
    return (
      '<button type="button" class="icon-btn" aria-checked="' +
      (checked ? "true" : "false") +
      '" role="radio" title="' +
      title +
      '">' +
      label +
      "</button>"
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
        '<tr class="empty"><td colspan="9">Select sketch points to add rows</td></tr>';
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
          '<td class="col-flip"><span class="icon-group">' +
          iconToggle("H", row.flipH, "Flip horizontal") +
          iconToggle("V", row.flipV, "Flip vertical") +
          "</span></td>" +
          '<td class="col-justify"><span class="icon-group" role="radiogroup">' +
          iconRadio("L", row.justify === "left", "Justify left") +
          iconRadio("C", row.justify === "center", "Justify center") +
          iconRadio("R", row.justify === "right", "Justify right") +
          "</span></td>" +
          '<td class="col-align"><span class="icon-group" role="radiogroup">' +
          iconRadio("T", row.align === "top", "Align top") +
          iconRadio("M", row.align === "middle", "Align middle") +
          iconRadio("B", row.align === "bottom", "Align bottom") +
          "</span></td>" +
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

    tbody.querySelectorAll(".icon-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var pressed = btn.getAttribute("aria-pressed");
        if (pressed !== null) {
          btn.setAttribute(
            "aria-pressed",
            pressed === "true" ? "false" : "true"
          );
          return;
        }
        var group = btn.parentElement;
        if (!group) return;
        group.querySelectorAll(".icon-btn").forEach(function (b) {
          b.setAttribute("aria-checked", "false");
        });
        btn.setAttribute("aria-checked", "true");
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

  opRadios.forEach(function (r) {
    r.addEventListener("change", syncTargetVisibility);
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
  syncTargetVisibility();
  syncApplyRefVisibility();
  syncFrameDimsVisibility();
  syncOkVisibility();

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
