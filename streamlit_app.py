"""Urmi Text Tools — Streamlit entry point (Конвертеры)."""

from __future__ import annotations

import pandas as pd
import streamlit as st

from converters.engine import convert_text, get_correspondence_table
from converters.files import process_file
from ui_common import inject_style, system_select

st.set_page_config(
    page_title="Конвертеры — Urmi Text Tools",
    page_icon="🔤",
    layout="wide",
    initial_sidebar_state="expanded",
)

inject_style()

st.title("Конвертеры письменностей")
st.markdown(
    '<p class="hero-sub">Переводит текст между системами записи христианского урмийского: '
    "раскладкой экспедиции, Khan&nbsp;2016, Церетели&nbsp;1964, «Новым алфавитом» и кириллицей. "
    "Знак <strong>+</strong> при конвертации всегда сохраняется. Можно ввести текст в окно "
    "или загрузить файл (txt, csv, docx, xlsx, pdf, flextext) и скачать результат "
    "в том же формате.</p>",
    unsafe_allow_html=True,
)

mode = st.radio(
    "Режим",
    ["Текст в окне", "Файл"],
    horizontal=True,
    label_visibility="collapsed",
)

c1, c_swap, c2 = st.columns([5, 1, 5])
with c1:
    source = system_select("Из системы", "conv_source", "expedition")
with c2:
    target = system_select("В систему", "conv_target", "khan")
with c_swap:
    st.write("")
    st.write("")
    if st.button("⇄", help="Поменять системы", use_container_width=True):
        st.session_state["conv_source"], st.session_state["conv_target"] = (
            st.session_state.get("conv_target", target),
            st.session_state.get("conv_source", source),
        )
        st.rerun()

# Re-read after possible swap stored in session
source = st.session_state.get("conv_source", source)
target = st.session_state.get("conv_target", target)

if mode == "Текст в окне":
    left, right = st.columns(2)
    with left:
        st.text_area("Ввод", height=260, placeholder="Вставьте текст…", key="conv_in")
    with right:
        if "conv_out_box" not in st.session_state:
            st.session_state["conv_out_box"] = st.session_state.get("conv_out", "")
        st.text_area("Результат", height=260, key="conv_out_box")

    b1, b2, b3 = st.columns([1, 1, 1])
    with b1:
        if st.button("Конвертировать", type="primary", use_container_width=True):
            out = convert_text(st.session_state.get("conv_in", ""), source, target)
            st.session_state["conv_out"] = out
            st.session_state["conv_out_box"] = out
            st.rerun()
    with b2:
        st.download_button(
            "Скачать результат (.txt)",
            data=st.session_state.get("conv_out", "").encode("utf-8"),
            file_name="converted.txt",
            mime="text/plain",
            use_container_width=True,
            disabled=not st.session_state.get("conv_out"),
        )
    with b3:
        if st.button("Очистить", use_container_width=True):
            st.session_state["conv_out"] = ""
            st.session_state["conv_in"] = ""
            st.session_state["conv_out_box"] = ""
            st.rerun()
else:
    uploaded = st.file_uploader(
        "Загрузите txt, csv, docx, xlsx, pdf или flextext",
        type=["txt", "csv", "docx", "xlsx", "pdf", "flextext", "xml"],
    )
    if st.button("Конвертировать и скачать", type="primary", disabled=uploaded is None):
        assert uploaded is not None
        data = uploaded.getvalue()

        def transform(t: str) -> str:
            return convert_text(t, source, target)

        try:
            out, out_name, media = process_file(uploaded.name, data, transform)
        except ValueError as e:
            st.error(str(e))
        else:
            st.download_button(
                "Скачать результат",
                data=out,
                file_name=out_name,
                mime=media.split(";")[0],
                type="primary",
            )
    st.caption(
        "PDF: текст извлекается и собирается в новый PDF. "
        "Для сложной вёрстки надёжнее docx / txt / flextext."
    )

st.divider()
st.subheader("Таблица соответствий")
st.caption("По этой таблице работает конвертер для всех письменностей.")

table = get_correspondence_table()
rows = table["rows"]
display_rows = []
last_cat = None
for row in rows:
    if row["category"] != last_cat:
        last_cat = row["category"]
        display_rows.append(
            {
                "Раскладка экспедиции": f"▸ {row['category']}",
                "Khan 2016": "",
                "Церетели 1964": "",
                "«Новый алфавит»": "",
                "Кириллица": "",
                "Произносится": "",
                "Клавиатурная раскладка": "",
                "Буква ассирийского алфавита": "",
            }
        )
    display_rows.append(
        {
            "Раскладка экспедиции": row["expedition"],
            "Khan 2016": row["khan"],
            "Церетели 1964": row["cereteli"],
            "«Новый алфавит»": row["novyi"],
            "Кириллица": row["cyrillic"],
            "Произносится": row["pron"],
            "Клавиатурная раскладка": row["layout"],
            "Буква ассирийского алфавита": row["assyrian"],
        }
    )

st.dataframe(pd.DataFrame(display_rows), use_container_width=True, hide_index=True)
