# Engraving Text on Point — add-in entry (scaffold)
# Full command + geometry land in later phases; see docs/PLAN.md.

import adsk.core
import adsk.fusion
import traceback

_app = adsk.core.Application.cast(None)
_ui = adsk.core.UserInterface.cast(None)


def run(context: str) -> None:
    global _app, _ui
    try:
        _app = adsk.core.Application.get()
        _ui = _app.userInterface
        # Phase 0: registration only — command + palette wired in Phase 1.
        _ui.messageBox(
            "Engraving Text on Point scaffold loaded.\n"
            "See docs/PLAN.md for the implementation plan.",
            "Engraving Text on Point",
        )
    except Exception:
        if _ui:
            _ui.messageBox("Failed:\n{}".format(traceback.format_exc()))


def stop(context: str) -> None:
    global _ui
    try:
        pass
    except Exception:
        if _ui:
            _ui.messageBox("Failed:\n{}".format(traceback.format_exc()))
