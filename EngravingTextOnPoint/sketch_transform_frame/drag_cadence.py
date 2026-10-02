# Driven-during-drag / auto-apply driving — Phase 2.
#
# Cadence (host-owned timing):
#   drag start / triad ticks → isDriving = False on affected Ref/Orient dims
#   mouseDragEnd             → start debounce; dims stay driven
#   debounce fire            → apply_driving_from_pose()  # auto-apply
#                            → THEN host doExecutePreview()
#
# Auto-apply = convert driven dims to driving from measured pose.
# Must run between debounce fire and execute preview — never mid-drag,
# never inside executePreview while dims are still driven.
