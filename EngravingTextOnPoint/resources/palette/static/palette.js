/**
 * Palette shell — theme + batch UI only.
 * Fusion bridge (adsk.fusionSendData) is wired in Phase 1.
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

  let mockRowCount = 0;
  let mockOrient = false;
  let mockRef = false;

  const btnApplyRef = document.getElementById("btn-apply-ref");

  if (btnRef) {
    btnRef.addEventListener("click", function () {
      mockRef = !mockRef;
      if (refLabel) {
        refLabel.textContent = mockRef
          ? "Mock ref ready"
          : "New or existing free pts";
      }
      if (statusEl) {
        statusEl.textContent = mockRef
          ? "Ref set — Add Point or Apply Ref Dims on unconstrained point — dummy UI"
          : "";
      }
    });
  }

  if (btnApplyRef) {
    btnApplyRef.addEventListener("click", function () {
      var dx = document.getElementById("dim-dx");
      var dy = document.getElementById("dim-dy");
      if (mockRef && dx && dy) {
        dx.disabled = false;
        dy.disabled = false;
        dx.value = "10 mm";
        dy.value = "5 mm";
      }
      if (statusEl) {
        statusEl.textContent = mockRef
          ? "dX/dY editable via GUI or triad translate — dummy UI"
          : "Select a Ref point first — dummy UI";
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

  // Dummy: mock triad settle → push pose into GUI dims (two-way counterpart).
  function mockTriadSettled(dx, dy, angle) {
    var dxEl = document.getElementById("dim-dx");
    var dyEl = document.getElementById("dim-dy");
    var angEl = document.getElementById("dim-angle");
    if (mockRef && dxEl && dyEl) {
      dxEl.disabled = false;
      dyEl.disabled = false;
      dxEl.value = dx;
      dyEl.value = dy;
    }
    if (mockOrient && angEl) {
      angEl.disabled = false;
      angEl.value = angle;
    }
    if (statusEl) {
      statusEl.textContent =
        "Would sync GUI from triad settle — dummy UI (dX=" +
        dx +
        ", dY=" +
        dy +
        ", Angle=" +
        angle +
        ")";
    }
  }

  if (btnOrient) {
    btnOrient.addEventListener("click", function () {
      mockOrient = true;
      if (orientLabel) orientLabel.textContent = "Mock vector";
      var ang = document.getElementById("dim-angle");
      if (ang) {
        ang.disabled = false;
        ang.value = "0 deg";
      }
      if (manipStatus) {
        manipStatus.textContent =
          "Manipulators: Angle dim ✓ · Move ✓ (unconstrained mock point)";
      }
      if (statusEl) {
        statusEl.textContent =
          "Angle editable via GUI or triad rotate — dummy UI";
      }
    });
  }

  // Dummy triad gesture: clicking manip status simulates a settle sync into GUI.
  if (manipStatus) {
    manipStatus.style.cursor = "pointer";
    manipStatus.title = "Click to mock triad settle → GUI dim sync";
    manipStatus.addEventListener("click", function () {
      if (!mockRef && !mockOrient) {
        if (statusEl) {
          statusEl.textContent =
            "Set Ref and/or Orient first to mock triad → GUI dim sync — dummy UI";
        }
        return;
      }
      mockTriadSettled(
        mockRef ? "12 mm" : "—",
        mockRef ? "5 mm" : "—",
        mockOrient ? "15 deg" : "—"
      );
    });
  }

  // Dummy UI: Add Point appends a fake selection count only.
  if (btnAddPoint) {
    btnAddPoint.disabled = false;
    btnAddPoint.addEventListener("click", function () {
      mockRowCount += 1;
      if (pointsCount) {
        pointsCount.textContent = mockRowCount + " selected";
      }
      if (statusEl) {
        statusEl.textContent =
          "Would place point via preselect + custom-graphics projection ghost — dummy UI";
      }
      if (manipStatus) {
        manipStatus.textContent =
          "Manipulators: Angle ✓ · Move ✓ (unconstrained mock point)";
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

  function syncTargetEnabled() {
    const op = document.querySelector('input[name="op"]:checked').value;
    const cut = op === "cut";
    targetRow.style.opacity = cut ? "1" : "0.45";
    targetRow.style.pointerEvents = cut ? "auto" : "none";
  }

  opRadios.forEach(function (r) {
    r.addEventListener("change", syncTargetEnabled);
  });
  syncTargetEnabled();

  function syncPreviewStatus() {
    if (!statusEl) return;
    statusEl.textContent = livePreview.checked
      ? ""
      : "Preview off — OK will create features";
  }

  livePreview.addEventListener("change", syncPreviewStatus);
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
