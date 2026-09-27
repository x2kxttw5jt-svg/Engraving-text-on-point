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
  const pointsCount = document.getElementById("points-count");
  const opRadios = document.querySelectorAll('input[name="op"]');
  const targetRow = document.getElementById("target-row");

  let mockRowCount = 0;

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
