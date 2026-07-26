"""Conversion and alphabet-cleaning engines. The plus sign (+) is never altered."""

from __future__ import annotations

import unicodedata
from functools import lru_cache

from .data import (
    ALPHABETS,
    FROM_HUB,
    ROWS,
    SYSTEM_IDS,
    SYSTEMS,
    TO_HUB,
    correspondence_table_for_display,
)

PLUS = "+"
# Acute accent = stress mark in expedition vowels (á / á, ə́, …).
# Not the same as phonemic diacritics (ṭ, č, ṗ, …).
_STRESS_MARKS = frozenset({"\u0301"})


def strip_stress(text: str) -> str:
    """Remove acute stress marks; keep all other combining diacritics."""
    if not text:
        return text
    d = unicodedata.normalize("NFD", text)
    d = "".join(ch for ch in d if ch not in _STRESS_MARKS)
    return unicodedata.normalize("NFC", d)


def get_correspondence_table():
    return {
        "systems": SYSTEMS,
        "rows": correspondence_table_for_display(),
    }


def get_alphabet(system_id: str, keep_stress: bool = True) -> list[str]:
    if system_id not in ALPHABETS:
        raise ValueError(f"Unknown system: {system_id}")
    forms = sorted(ALPHABETS[system_id], key=lambda s: (-len(s), s))
    seen: set[str] = set()
    out: list[str] = []
    for f in forms:
        n = unicodedata.normalize("NFC", f)
        if not keep_stress:
            n = strip_stress(n)
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


@lru_cache(maxsize=16)
def _token_list(system_id: str) -> tuple[str, ...]:
    """Tokens sorted longest-first for greedy matching."""
    tokens = list(TO_HUB[system_id].keys())
    tokens.sort(key=lambda s: (-len(s), s))
    return tuple(tokens)


def _is_whitespace(ch: str) -> bool:
    return ch.isspace() or unicodedata.category(ch) in ("Zs", "Zl", "Zp")


def _match_token(text: str, i: int, system_id: str) -> tuple[str, int] | None:
    """Return (matched_token, end_index) or None."""
    # Try as-is, then lowercase for case-folded Latin/Cyrillic bases
    for candidate_text, offset_case in ((text, False), (text[:i] + text[i:].lower(), True)):
        src = candidate_text if offset_case else text
        for tok in _token_list(system_id):
            if src.startswith(tok, i):
                return tok, i + len(tok)
    return None


def convert_text(text: str, source: str, target: str) -> str:
    """
    Convert text from one orthography to another via the expedition hub.
    The character '+' is always preserved as '+'.
    Unmatched characters are left unchanged.
    """
    if source not in SYSTEM_IDS:
        raise ValueError(f"Unknown source system: {source}")
    if target not in SYSTEM_IDS:
        raise ValueError(f"Unknown target system: {target}")
    if not text:
        return text
    if source == target:
        return text

    s = unicodedata.normalize("NFC", text)
    out: list[str] = []
    i = 0
    n = len(s)

    while i < n:
        ch = s[i]
        if ch == PLUS:
            out.append(PLUS)
            i += 1
            continue
        if _is_whitespace(ch):
            out.append(ch)
            i += 1
            continue

        matched = _match_token(s, i, source)
        if matched is None:
            out.append(ch)
            i += 1
            continue

        tok, end = matched
        hub_idx = TO_HUB[source][tok]
        target_form = FROM_HUB[hub_idx].get(target)
        # No dedicated symbol in target orthography → leave the matched token as-is
        out.append(target_form if target_form is not None else tok)
        i = end

    return "".join(out)


def clean_text(
    text: str,
    system_id: str,
    keep_whitespace: bool = True,
    keep_stress: bool = True,
) -> str:
    """
    Keep only characters belonging to the selected alphabet, plus '+'.
    Whitespace is kept by default (structural, not a foreign letter).
    If keep_stress is False, acute accents on vowels are stripped (á→a, ə́→ə).
    """
    if system_id not in SYSTEM_IDS:
        raise ValueError(f"Unknown system: {system_id}")
    if not text:
        return text

    s = unicodedata.normalize("NFC", text)
    if not keep_stress:
        s = strip_stress(s)

    allowed_tokens = _token_list(system_id)
    if not keep_stress:
        # Match against stress-stripped tokens (deduped, longest first)
        stripped = {strip_stress(t) for t in allowed_tokens}
        allowed_tokens = tuple(sorted((t for t in stripped if t), key=lambda x: (-len(x), x)))

    out: list[str] = []
    i = 0
    n = len(s)

    while i < n:
        ch = s[i]
        if ch == PLUS:
            out.append(PLUS)
            i += 1
            continue
        if keep_whitespace and _is_whitespace(ch):
            out.append(ch)
            i += 1
            continue

        matched = False
        lower_slice = s[i:].lower()
        for tok in allowed_tokens:
            if s.startswith(tok, i) or lower_slice.startswith(tok):
                piece = s[i : i + len(tok)]
                out.append(piece if keep_stress else strip_stress(piece))
                i += len(tok)
                matched = True
                break
        if not matched:
            i += 1

    return "".join(out)


# Re-export for API convenience
__all__ = [
    "SYSTEMS",
    "SYSTEM_IDS",
    "ROWS",
    "clean_text",
    "convert_text",
    "get_alphabet",
    "get_correspondence_table",
    "strip_stress",
]
