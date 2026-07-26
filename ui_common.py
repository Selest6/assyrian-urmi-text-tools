"""Shared Streamlit helpers for Urmi Text Tools."""

from __future__ import annotations

import streamlit as st

from converters.engine import SYSTEMS

SYSTEM_LABELS = {s["id"]: s["label"] for s in SYSTEMS}
SYSTEM_IDS = [s["id"] for s in SYSTEMS]

PASTEL_CSS = """
<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap');

html, body, [class*="css"] {
  font-family: "Manrope", system-ui, sans-serif;
}

.stApp {
  background:
    radial-gradient(900px 420px at 8% -5%, #ffe8d8 0%, transparent 55%),
    radial-gradient(700px 380px at 95% 0%, #d9f3ec 0%, transparent 50%),
    linear-gradient(165deg, #f7f3ee, #eef6f4 55%, #f3eef8);
}

h1, h2, h3 {
  font-family: "Fraunces", Georgia, serif !important;
  letter-spacing: -0.02em;
}

div[data-testid="stSidebar"] {
  background: rgba(255, 255, 255, 0.55);
}

.block-container {
  padding-top: 1.4rem;
  max-width: 1100px;
}

.hero-sub {
  color: #5c6678;
  font-size: 1.02rem;
  line-height: 1.55;
  margin: -0.4rem 0 1.2rem;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0.4rem 0 0.8rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.8rem;
  padding: 0.28rem 0.5rem;
  border-radius: 10px;
  background: rgba(255,255,255,0.85);
  border: 1px solid rgba(42,49,64,0.1);
  font-weight: 600;
}
</style>
"""


def inject_style() -> None:
    st.markdown(PASTEL_CSS, unsafe_allow_html=True)


def system_select(label: str, key: str, default_id: str = "expedition") -> str:
    default_idx = SYSTEM_IDS.index(default_id) if default_id in SYSTEM_IDS else 0
    return st.selectbox(
        label,
        options=SYSTEM_IDS,
        index=default_idx,
        format_func=lambda i: SYSTEM_LABELS[i],
        key=key,
    )
