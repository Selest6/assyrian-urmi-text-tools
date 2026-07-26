"""Build runtime JSON for the browser engine (same data as converters.engine)."""

from __future__ import annotations

from converters.data import FROM_HUB, SYSTEM_IDS, SYSTEMS, TO_HUB
from converters.engine import get_alphabet, get_correspondence_table


def build_runtime() -> dict:
    return {
        "systems": SYSTEMS,
        "system_ids": SYSTEM_IDS,
        "to_hub": TO_HUB,
        "from_hub": {str(k): v for k, v in FROM_HUB.items()},
        "table": get_correspondence_table(),
        "alphabets": {sid: get_alphabet(sid, keep_stress=True) for sid in SYSTEM_IDS},
        "alphabets_nostress": {
            sid: get_alphabet(sid, keep_stress=False) for sid in SYSTEM_IDS
        },
    }
