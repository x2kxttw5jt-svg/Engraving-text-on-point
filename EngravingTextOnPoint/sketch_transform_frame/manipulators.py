# TriadCommandInput: snap + delta-matrix sketch.move on inputChanged — Phase 2.
# Unified scale is host-owned → SketchText.heightParameter (not geometric sketch.move).
# Host: mouseDragEnd → debounce → apply_driving_from_pose → reset unifiedScaleFactor
#       → doExecutePreview; execute = commit only.
# Re-entrancy guards live in the host command; quantize helpers live here.
