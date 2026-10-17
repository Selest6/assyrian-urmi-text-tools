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
# Typographic apostrophes used in г' (U+0027 is the table form).
_GAMMA_APOSTROPHES = frozenset({"'", "\u2019", "\u2018", "\u02bc"})
_VOWEL_BASES = frozenset("aeiouəǝAEIOUƏƎаэиоуыАЭИОУЫ")


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


def _fold_gamma_apostrophe(text: str) -> str:
    """Treat г’ / гʼ as the table letter г'."""
    out: list[str] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if ch in ("г", "Г") and nxt in _GAMMA_APOSTROPHES:
            out.append(ch)
            out.append("'")
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def _cased_letters(text: str) -> list[str]:
    bare = strip_stress(text)
    return [ch for ch in bare if unicodedata.category(ch).startswith("L")]


def _apply_case(source_slice: str, target: str) -> str:
    """Keep lower / Capital / ALL CAPS of the matched source letter."""
    letters = _cased_letters(source_slice)
    if not letters:
        return target
    if all(ch.isupper() for ch in letters):
        return target.upper()
    if letters[0].isupper() and all(not ch.isupper() for ch in letters[1:]):
        chars = list(target)
        for i, ch in enumerate(chars):
            if unicodedata.category(ch).startswith("L"):
                chars[i] = ch.upper()
                return "".join(chars)
    return target


def _apply_stress(source_slice: str, target: str) -> str:
    """Carry an acute onto the converted vowel. Skip targets with no vowel (ь)."""
    if "\u0301" not in unicodedata.normalize("NFD", source_slice):
        return target
    if "\u0301" in unicodedata.normalize("NFD", target):
        return target
    if not any(strip_stress(ch) in _VOWEL_BASES for ch in target):
        return target
    nfd = unicodedata.normalize("NFD", target)
    out: list[str] = []
    inserted = False
    for ch in nfd:
        out.append(ch)
        if not inserted and not unicodedata.combining(ch):
            out.append("\u0301")
            inserted = True
    return unicodedata.normalize("NFC", "".join(out))


def _match_at(text: str, i: int, system_id: str) -> tuple[str, int] | None:
    for tok in _token_list(system_id):
        if text.startswith(tok, i):
            return tok, i + len(tok)
    return None


def _match_token(text: str, i: int, system_id: str) -> tuple[str, int] | None:
    """Return (matched_token, end_index) or None.

    Matching ignores case. A precomposed stressed vowel (á) also matches its
    base when that base is the listed sign.
    """
    found = _match_at(text, i, system_id)
    if found:
        return found
    folded = text[:i] + text[i:].lower()
    found = _match_at(folded, i, system_id)
    if found:
        return found
    base = strip_stress(text[i])
    if base == text[i]:
        return None
    rewritten = text[:i] + base + text[i + 1 :]
    found = _match_at(rewritten, i, system_id)
    if found:
        return found
    return _match_at(rewritten[:i] + rewritten[i:].lower(), i, system_id)


def _word_case(letters: list[str]) -> str:
    """lower / title / upper / mixed, judged on the whole word."""
    if not letters:
        return "lower"
    if all(ch.isupper() for ch in letters):
        # One capital letter ("G", "B") titles a digraph: G→Дж, not ДЖ.
        return "title" if len(letters) == 1 else "upper"
    if letters[0].isupper() and all(not ch.isupper() for ch in letters[1:]):
        return "title"
    return "mixed"


def _convert_segment(segment: str, source: str, target: str) -> str:
    """Convert one word. Case follows the word, not each letter."""
    pieces: list[dict] = []
    i = 0
    n = len(segment)
    while i < n:
        matched = _match_token(segment, i, source)
        if matched is None:
            pieces.append({"raw": segment[i]})
            i += 1
            continue
        tok, end = matched
        original = segment[i:end]
        target_form = FROM_HUB[TO_HUB[source][tok]].get(target)
        if target_form is None:
            pieces.append({"raw": original})
        else:
            pieces.append(
                {
                    "target": target_form,
                    "original": original,
                    "stress": "\u0301" in unicodedata.normalize("NFD", original),
                }
            )
        i = end

    letters: list[str] = []
    for piece in pieces:
        letters.extend(_cased_letters(piece.get("original") or piece.get("raw") or ""))
    pattern = _word_case(letters)

    out: list[str] = []
    for piece in pieces:
        if "raw" in piece:
            out.append(piece["raw"])
            continue
        chunk = piece["target"]
        if pattern == "upper":
            chunk = chunk.upper()
        elif pattern == "mixed":
            chunk = _apply_case(piece["original"], chunk)
        if piece["stress"]:
            chunk = _apply_stress(piece["original"], chunk)
        out.append(chunk)
    result = "".join(out)
    if pattern == "title":
        result = _upper_first_letter(result)
    return result


def _upper_first_letter(text: str) -> str:
    chars = list(text)
    for i, ch in enumerate(chars):
        if unicodedata.category(ch).startswith("L"):
            chars[i] = ch.upper()
            return "".join(chars)
    return text


def convert_text(text: str, source: str, target: str) -> str:
    """
    Convert text from one orthography to another via the expedition hub.
    The character '+' is always preserved as '+'.
    Capitalization is preserved (B→Б, BRATA→БРАТА).
    An acute stress mark is carried onto the converted vowel (á→а́).
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

    s = _fold_gamma_apostrophe(unicodedata.normalize("NFC", text))
    out: list[str] = []
    i = 0
    n = len(s)
    while i < n:
        ch = s[i]
        if ch == PLUS or _is_whitespace(ch):
            out.append(ch)
            i += 1
            continue
        j = i + 1
        while j < n and s[j] != PLUS and not _is_whitespace(s[j]):
            j += 1
        out.append(_convert_segment(s[i:j], source, target))
        i = j
    return unicodedata.normalize("NFC", "".join(out))


def clean_text(
    text: str,
    system_id: str,
    normalize_whitespace: bool = False,
    keep_stress: bool = True,
    lowercase: bool = False,
) -> str:
    """
    Keep only characters belonging to the selected alphabet, plus '+'.
    Whitespace is always kept. If normalize_whitespace is True, every run of
    whitespace (spaces, tabs, newlines, …) becomes a single regular space.
    If keep_stress is False, acute accents on vowels are stripped (á→a, ə́→ə).
    If lowercase is True, capital letters are folded to lowercase.
    """
    if system_id not in SYSTEM_IDS:
        raise ValueError(f"Unknown system: {system_id}")
    if not text:
        return text

    s = _fold_gamma_apostrophe(unicodedata.normalize("NFC", text))
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
        if _is_whitespace(ch):
            if normalize_whitespace:
                while i < n and _is_whitespace(s[i]):
                    i += 1
                out.append(" ")
            else:
                out.append(ch)
                i += 1
            continue

        matched = False
        lower_slice = s[i:].lower()
        for tok in allowed_tokens:
            if s.startswith(tok, i) or lower_slice.startswith(tok):
                piece = s[i : i + len(tok)]
                if not keep_stress:
                    piece = strip_stress(piece)
                if lowercase:
                    piece = piece.lower()
                out.append(piece)
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
