"""Correspondence table and orthography inventories.

Source: Sounds_symbols_letters_table.docx
Column «Запись» is shown on the site as «Раскладка экспедиции».
Cyrillic mapping follows the Hugging Face Selest converters (researchers ↔ Cyrillic).
"""

from __future__ import annotations

import unicodedata
from typing import Any

# Display order and IDs
SYSTEMS: list[dict[str, str]] = [
    {"id": "expedition", "label": "Раскладка экспедиции"},
    {"id": "khan", "label": "Khan 2016"},
    {"id": "cereteli", "label": "Церетели 1964"},
    {"id": "novyi", "label": "«Новый алфавит»"},
    {"id": "cyrillic", "label": "Кириллица"},
]

SYSTEM_IDS = [s["id"] for s in SYSTEMS]


def _n(s: str) -> str:
    return unicodedata.normalize("NFC", s.strip())


# Each row: phoneme correspondence. Primary form first in each list.
# Empty list = no dedicated symbol (pass through / use expedition vowel).
ROWS: list[dict[str, Any]] = [
    # --- stops ---
    {
        "category": "Взрывные / Stops",
        "pron": "[ph] lax",
        "layout": "p",
        "assyrian": "пи",
        "expedition": ["p"],
        "khan": ["p"],
        "cereteli": ["p"],
        "novyi": ["p"],
        "cyrillic": ["п"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[p] tense",
        "layout": "p + AltGr",
        "assyrian": "пи",
        "expedition": ["ṗ", "ṗ"],  # p+̇ and precomposed
        "khan": ["p̌"],
        "cereteli": ["p."],
        "novyi": ["p"],  # ambiguous with lax p
        "cyrillic": ["пъ"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[b]",
        "layout": "b",
        "assyrian": "бит",
        "expedition": ["b"],
        "khan": ["b"],
        "cereteli": ["b"],
        "novyi": ["в"],
        "cyrillic": ["б"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[th] lax",
        "layout": "t",
        "assyrian": "тав",
        "expedition": ["t"],
        "khan": ["t"],
        "cereteli": ["t"],
        "novyi": ["t"],
        "cyrillic": ["т"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[t] tense",
        "layout": "t + AltGr",
        "assyrian": "тет",
        "expedition": ["ṭ", "ṭ"],
        "khan": ["ṱ"],
        "cereteli": ["ṭ", "ṭ"],
        "novyi": ["ţ"],
        "cyrillic": ["тъ"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[d]",
        "layout": "d",
        "assyrian": "далят",
        "expedition": ["d"],
        "khan": ["d"],
        "cereteli": ["d"],
        "novyi": ["d"],
        "cyrillic": ["д"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[tʃh] / [ch] lax",
        "layout": "c",
        "assyrian": "кяп",
        "expedition": ["c"],
        "khan": ["c"],
        "cereteli": ["k"],
        "novyi": ["k"],
        "cyrillic": ["ч"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[tʃ] / [c] tense",
        "layout": "<[б]+ AltGr",
        "assyrian": "кяп, коп",
        "expedition": ["c̣"],
        "khan": ["c̭"],
        "cereteli": ["ḳ"],
        "novyi": ["k"],
        "cyrillic": ["чъ"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[dʒ] / [ɟ]",
        "layout": "g",
        "assyrian": "гямаль",
        "expedition": ["g"],
        "khan": ["ɟ"],
        "cereteli": ["g"],
        "novyi": ["g"],
        "cyrillic": ["дж"],
    },
    {
        "category": "Взрывные / Stops",
        "pron": "[k] (tense)",
        "layout": "",
        "assyrian": "коп",
        "expedition": ["k"],
        "khan": ["k̭"],
        "cereteli": ["q"],
        "novyi": ["q"],
        "cyrillic": ["к"],
    },
    # --- affricates ---
    {
        "category": "Аффрикаты / Affricates",
        "pron": "[tʃh] lax",
        "layout": "c + AltGr",
        "assyrian": "кяп+маджлеяна",
        "expedition": ["č"],
        "khan": ["č"],
        "cereteli": ["č"],
        "novyi": ["c"],
        "cyrillic": ["ч"],
    },
    {
        "category": "Аффрикаты / Affricates",
        "pron": "[tʃ] tense",
        "layout": ">[ю]+ AltGr",
        "assyrian": "кяп+маджлеяна",
        "expedition": ["č̣"],
        "khan": ["č̭"],
        "cereteli": ["č̣"],
        "novyi": ["c"],
        "cyrillic": ["чъ"],
    },
    {
        "category": "Аффрикаты / Affricates",
        "pron": "[dʒ]",
        "layout": "g + AltGr",
        "assyrian": "гямаль+маджл.",
        "expedition": ["ǧ", "ǧ"],
        "khan": ["j"],
        "cereteli": ["ǧ", "ǧ"],
        "novyi": ["ç"],
        "cyrillic": ["дж"],
    },
    # --- fricatives ---
    {
        "category": "Щелевые / Fricatives",
        "pron": "[f]",
        "layout": "f",
        "assyrian": "",
        "expedition": ["f"],
        "khan": ["f"],
        "cereteli": ["f"],
        "novyi": ["f"],
        "cyrillic": ["ф"],
    },
    {
        "category": "Щелевые / Fricatives",
        "pron": "[v], [w]",
        "layout": "v",
        "assyrian": "вав",
        "expedition": ["v"],
        "khan": ["v"],
        "cereteli": ["v", "u̯"],
        "novyi": ["v"],
        "cyrillic": ["в"],
    },
    {
        "category": "Щелевые / Fricatives",
        "pron": "[s]",
        "layout": "s",
        "assyrian": "симкят, садэ",
        "expedition": ["s"],
        "khan": ["s"],
        "cereteli": ["s"],
        "novyi": ["s"],
        "cyrillic": ["с"],
    },
    {
        "category": "Щелевые / Fricatives",
        "pron": "[z]",
        "layout": "s",
        "assyrian": "зэн",
        "expedition": ["z"],
        "khan": ["z"],
        "cereteli": ["z"],
        "novyi": ["z"],
        "cyrillic": ["з"],
    },
    {
        "category": "Щелевые / Fricatives",
        "pron": "[ʃ]",
        "layout": "s + AltGr",
        "assyrian": "шин",
        "expedition": ["š"],
        "khan": ["š"],
        "cereteli": ["š"],
        "novyi": ["ş"],
        "cyrillic": ["ш"],
    },
    {
        "category": "Щелевые / Fricatives",
        "pron": "[ʒ]",
        "layout": "z + AltGr",
        "assyrian": "шин, зэн+маджл.",
        "expedition": ["ž"],
        "khan": ["ž"],
        "cereteli": ["ž"],
        "novyi": ["ƶ"],
        "cyrillic": ["ж"],
    },
    {
        "category": "Щелевые / Fricatives",
        "pron": "[x]",
        "layout": "x",
        "assyrian": "хэт",
        "expedition": ["x"],
        "khan": ["x"],
        "cereteli": ["ḫ"],
        "novyi": ["h"],
        "cyrillic": ["х"],
    },
    {
        "category": "Щелевые / Fricatives",
        "pron": "[ɣ]",
        "layout": "r + AltGr",
        "assyrian": "гямаль+руккаха",
        "expedition": ["ɣ"],
        "khan": ["ġ", "ġ"],
        "cereteli": ["ġ", "ġ"],
        "novyi": ["h", "x"],
        "cyrillic": ["г'"],
    },
    {
        "category": "Щелевые / Fricatives",
        "pron": "[h]",
        "layout": "h",
        "assyrian": "hи",
        "expedition": ["h"],
        "khan": ["h"],
        "cereteli": ["h"],
        "novyi": ["h"],
        "cyrillic": ["h"],
    },
    # --- sonorants ---
    {
        "category": "Сонорные",
        "pron": "",
        "layout": "y",
        "assyrian": "йод",
        "expedition": ["y"],
        "khan": ["y"],
        "cereteli": ["i̯"],
        "novyi": ["о"],
        "cyrillic": ["й"],
    },
    {
        "category": "Сонорные",
        "pron": "",
        "layout": "m",
        "assyrian": "мим",
        "expedition": ["m"],
        "khan": ["m"],
        "cereteli": ["m"],
        "novyi": ["m"],
        "cyrillic": ["м"],
    },
    {
        "category": "Сонорные",
        "pron": "",
        "layout": "n",
        "assyrian": "нун",
        "expedition": ["n"],
        "khan": ["n"],
        "cereteli": ["n"],
        "novyi": ["n"],
        "cyrillic": ["н"],
    },
    {
        "category": "Сонорные",
        "pron": "",
        "layout": "l",
        "assyrian": "ламад",
        "expedition": ["l"],
        "khan": ["l"],
        "cereteli": ["l", "ł"],
        "novyi": ["l"],
        "cyrillic": ["л"],
    },
    {
        "category": "Сонорные",
        "pron": "",
        "layout": "r",
        "assyrian": "реш",
        "expedition": ["r"],
        "khan": ["r"],
        "cereteli": ["r"],
        "novyi": ["r"],
        "cyrillic": ["р"],
    },
    # --- vowels ---
    {
        "category": "Гласные",
        "pron": "",
        "layout": "a, AltGr + a",
        "assyrian": "",
        "expedition": ["a", "á", "á"],
        "khan": ["a"],
        "cereteli": ["a", "á"],
        "novyi": ["ə", "a"],
        "cyrillic": ["а"],
    },
    {
        "category": "Гласные",
        "pron": "",
        "layout": "e, AltGr + e",
        "assyrian": "",
        "expedition": ["e", "é", "é"],
        "khan": ["e"],
        "cereteli": ["e", "é"],
        "novyi": ["e"],
        "cyrillic": ["э"],
    },
    {
        "category": "Гласные",
        "pron": "",
        "layout": "i, AltGr + i",
        "assyrian": "",
        "expedition": ["i", "í", "í"],
        "khan": ["i"],
        "cereteli": ["i", "í"],
        "novyi": ["i", "ь"],
        "cyrillic": ["и"],
    },
    {
        "category": "Гласные",
        "pron": "",
        "layout": "o, AltGr + o",
        "assyrian": "",
        "expedition": ["o", "ó", "ó"],
        "khan": ["o"],
        "cereteli": ["o", "ó"],
        "novyi": ["o"],
        "cyrillic": ["о"],
    },
    {
        "category": "Гласные",
        "pron": "",
        "layout": "u, AltGr + u",
        "assyrian": "",
        "expedition": ["u", "ú", "ú"],
        "khan": ["u"],
        "cereteli": ["u", "ú"],
        "novyi": ["u"],
        "cyrillic": ["у"],
    },
    {
        "category": "Гласные",
        "pron": "",
        "layout": "w + AltGr, q + AltGr",
        "assyrian": "",
        "expedition": ["ə", "ə́", "ǝ"],
        "khan": ["ə", "ǝ"],
        "cereteli": ["ə", "ǝ"],
        "novyi": ["ь"],
        "cyrillic": ["ы"],
    },
]


def _normalize_forms(forms: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for f in forms:
        n = _n(f)
        if not n or n in seen:
            continue
        seen.add(n)
        out.append(n)
        # also store NFD twin if different
        d = unicodedata.normalize("NFD", n)
        if d not in seen:
            seen.add(d)
            out.append(d)
    return out


# Build lookup: system -> token -> hub_id (row index)
def build_maps() -> tuple[
    dict[str, dict[str, int]],
    dict[int, dict[str, str]],
    dict[str, set[str]],
]:
    to_hub: dict[str, dict[str, int]] = {sid: {} for sid in SYSTEM_IDS}
    from_hub: dict[int, dict[str, str]] = {}
    alphabets: dict[str, set[str]] = {sid: set() for sid in SYSTEM_IDS}

    for idx, row in enumerate(ROWS):
        from_hub[idx] = {}
        for sid in SYSTEM_IDS:
            forms = _normalize_forms(list(row.get(sid) or []))
            if not forms:
                continue
            primary = forms[0]
            from_hub[idx][sid] = primary
            for form in forms:
                # Prefer longer / earlier rows only if not already mapped —
                # we'll sort tokens by length at match time; for collisions
                # keep first-registered (earlier phoneme) unless longer token.
                prev = to_hub[sid].get(form)
                if prev is None:
                    to_hub[sid][form] = idx
                alphabets[sid].add(form)

    return to_hub, from_hub, alphabets


TO_HUB, FROM_HUB, ALPHABETS = build_maps()


def correspondence_table_for_display() -> list[dict[str, str]]:
    """Rows for the UI table (primary forms only)."""
    out: list[dict[str, str]] = []
    for row in ROWS:
        item = {
            "category": row["category"],
            "pron": row.get("pron") or "",
            "layout": row.get("layout") or "",
            "assyrian": row.get("assyrian") or "",
        }
        for sid in SYSTEM_IDS:
            forms = row.get(sid) or []
            item[sid] = forms[0] if forms else "—"
        out.append(item)
    return out
