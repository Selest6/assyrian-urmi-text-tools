"""Render the pastel HTML UI directly in the Streamlit page (no iframe)."""

from __future__ import annotations

import base64
import json
from pathlib import Path

import streamlit as st

from runtime_data import build_runtime

ROOT = Path(__file__).resolve().parent
STATIC = ROOT / "static"

# Streamlit chrome sits on top of the page: a header bar and a block-container
# padding. Hide those and let the original viewport gradient show through.
HIDE_CHROME = """
<style>
  #MainMenu, footer,
  [data-testid="stSidebar"],
  [data-testid="stSidebarCollapsedControl"],
  [data-testid="stToolbar"],
  [data-testid="stDecoration"],
  [data-testid="stStatusWidget"],
  [data-testid="stHeader"],
  .stAppHeader,
  [data-testid="stAppHeader"] {
    display: none !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  html {
    background:
      radial-gradient(1200px 600px at 10% -10%, #ffe8d8 0%, transparent 55%),
      radial-gradient(900px 500px at 95% 5%, #d9f3ec 0%, transparent 50%),
      radial-gradient(700px 480px at 70% 100%, #e7ddf7 0%, transparent 45%),
      linear-gradient(165deg, #f7f3ee, #eef6f4 45%, #f3eef8) !important;
    background-attachment: fixed !important;
    margin: 0 !important;
    border: none !important;
  }

  body {
    background: transparent !important;
    background-color: transparent !important;
    margin: 0 !important;
  }

  #root, .stApp,
  [data-testid="stAppViewContainer"] {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
  }

  [data-testid="stMain"],
  .stMain,
  [data-testid="stMainBlockContainer"],
  .stMainBlockContainer,
  .block-container,
  [data-testid="stAppScrollToBottomContainer"],
  [data-testid="stVerticalBlock"],
  [data-testid="stVerticalBlockBorderWrapper"],
  [data-testid="stElementContainer"],
  [data-testid="element-container"],
  [data-testid="stMarkdown"],
  [data-testid="stHtml"] {
    background: transparent !important;
    background-color: transparent !important;
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
    gap: 0 !important;
  }

  [data-testid="stAppViewContainer"],
  [data-testid="stMain"] {
    top: 0 !important;
    padding-top: 0 !important;
    margin-top: 0 !important;
  }

  /* Keep page content clear of Streamlit Cloud's corner badge when it is in-frame */
  a[href*="streamlit.io/cloud"],
  [class*="viewerBadge"],
  [data-testid="viewerBadge"] {
    display: none !important;
  }
</style>
"""


def _read(name: str) -> str:
    return (STATIC / name).read_text(encoding="utf-8")


def render_site(page: str) -> None:
    """
    page: 'converters' | 'cleaner'
    Renders the local HTML UI in the Streamlit document itself.
    """
    st.set_page_config(
        page_title="Urmi Text Tools",
        page_icon="🔤",
        layout="wide",
        initial_sidebar_state="collapsed",
    )
    # Style-only HTML is sent outside the layout, so it does not leave a gap.
    st.html(HIDE_CHROME)

    css = _read("style.css")
    engine = _read("engine.js")
    app_js = _read("app.js")
    # Both tools live in one document. Switching tabs only toggles visibility,
    # so Streamlit does not reload and the screen does not flash white.
    def _pane(name: str) -> str:
        hidden = "" if name == page else " hidden"
        return f'<div class="urmi-page" data-page="{name}"{hidden}>\n{_read(f"{name}.html")}\n</div>'

    body = _pane("converters") + "\n" + _pane("cleaner")
    runtime = json.dumps(build_runtime(), ensure_ascii=False).replace("<", "\\u003c")
    init = "initConvertersPage();\ninitCleanerPage();"
    # Inline scripts that contain tags like "</td>" are stripped by Streamlit's
    # sanitizer. Ship the program as base64 so the page script stays intact.
    program = f"""
window.URMI_RUNTIME = {runtime};
window.URMI_NAV = {{ converters: "/", cleaner: "/cleaner" }};
{engine}
{app_js}
{init}
"""
    # jsPDF and the PDF font travel inside the same program so the browser
    # does not have to fetch them. A cross-origin script tag was blocked.
    font_b64 = base64.b64encode((STATIC / "vendor" / "DejaVuSans-subset.ttf").read_bytes()).decode("ascii")
    jspdf = (STATIC / "vendor" / "jspdf.umd.min.js").read_text(encoding="utf-8")
    program = "window.URMI_PDF_FONT_B64 = " + json.dumps(font_b64) + ";\n" + jspdf + "\n" + program
    encoded = base64.b64encode(program.encode("utf-8")).decode("ascii")

    full = f"""<style>{css}</style>
{body}
<script>
(function () {{
  try {{
    var parentDoc = window.parent && window.parent.document;
    if (parentDoc && parentDoc !== document && !parentDoc.getElementById("urmi-hide-cloud-badge")) {{
      var style = parentDoc.createElement("style");
      style.id = "urmi-hide-cloud-badge";
      style.textContent = "a[class*='viewerBadge'],a[href*='streamlit.io/cloud'],[class*='profileContainer']{{display:none !important;}}";
      (parentDoc.head || parentDoc.documentElement).appendChild(style);
    }}
  }} catch (e) {{}}
  var bytes = Uint8Array.from(atob("{encoded}"), function (c) {{ return c.charCodeAt(0); }});
  (0, eval)(new TextDecoder("utf-8").decode(bytes));
}})();
</script>
"""
    st.html(full, unsafe_allow_javascript=True)
