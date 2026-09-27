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

  let mockRowCount = 0;
  let mockOrient = false;
  let mockRef = false;
  let mockRefDims = false;

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
  }

  function syncApplyRefVisibility() {
    setHidden(btnApplyRef, !mockRef);
  }

  function syncOkVisibility() {
    setHidden(btnOk, mockRowCount < 1);
  }

  function syncTargetVisibility() {
    const op = document.querySelector('input[name="op"]:checked');
    const cut = op && op.value === "cut";
    setHidden(targetRow, !cut);
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

  // Dummy: after debounce, auto-apply driven → driving, then solid preview.
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
      syncFrameDimsVisibility();
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

  // Dummy triad gesture: click manip status → settle (auto-apply + optional scale→Ht).
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

  // Dummy UI: Add Point appends a fake selection count only.
  if (btnAddPoint) {
    btnAddPoint.addEventListener("click", function () {
      mockRowCount += 1;
      if (pointsCount) {
        pointsCount.textContent = mockRowCount + " selected";
      }
      syncOkVisibility();
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
      mockRowCount += 1;
      if (pointsCount) {
        pointsCount.textContent = mockRowCount + " selected";
      }
      syncOkVisibility();
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

  // Default: light
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
    if (!statusEl) return;
    statusEl.textContent = livePreview.checked
      ? ""
      : "Preview off — OK will create features";
  }

  livePreview.addEventListener("change", syncPreviewStatus);

  // Initial visibility from conditions (hide, don't grey).
  syncTargetVisibility();
  syncApplyRefVisibility();
  syncFrameDimsVisibility();
  syncOkVisibility();
  syncPreviewStatus();

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
