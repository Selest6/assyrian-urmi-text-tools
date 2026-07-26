"""Embed the original pastel HTML UI inside Streamlit (hide Streamlit chrome)."""

from __future__ import annotations

import json
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

from runtime_data import build_runtime

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"

HIDE_CHROME = """
<style>
  #MainMenu, header, footer,
  [data-testid="stSidebar"],
  [data-testid="stSidebarCollapsedControl"],
  [data-testid="stToolbar"],
  [data-testid="stDecoration"],
  [data-testid="stStatusWidget"],
  [data-testid="stHeader"] {
    display: none !important;
    visibility: hidden !important;
  }
  [data-testid="stAppViewContainer"] > .main {
    background: transparent !important;
  }
  .block-container {
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
  }
  div[data-testid="stVerticalBlock"] > div { gap: 0 !important; }
  iframe { border: 0 !important; }
</style>
"""


def _read(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def render_site(page: str) -> None:
    """
    page: 'converters' | 'cleaner'
    Renders the exact local HTML UI inside Streamlit.
    """
    st.set_page_config(
        page_title="Urmi Text Tools",
        page_icon="🔤",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    st.markdown(HIDE_CHROME, unsafe_allow_html=True)

    css = _read("style.css")
    engine = _read("engine.js")
    app_js = _read("app.js")
    body = _read(f"{page}.html")
    runtime = json.dumps(build_runtime(), ensure_ascii=False)

    converters_href = "/"
    cleaner_href = "/Cleaner"

    full = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Urmi Text Tools</title>
  <style>{css}</style>
</head>
<body>
{body}
<script>
window.URMI_RUNTIME = {runtime};
window.URMI_NAV = {{
  converters: "{converters_href}",
  cleaner: "{cleaner_href}",
  target: "_parent"
}};
</script>
<script>{engine}</script>
<script>{app_js}</script>
<script>
  {"initConvertersPage();" if page == "converters" else "initCleanerPage();"}
</script>
</body>
</html>
"""
    components.html(full, height=3400, scrolling=True)
