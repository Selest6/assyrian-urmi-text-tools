"""Страница очистки текста."""

from __future__ import annotations

import html

import streamlit as st

from converters.engine import clean_text, get_alphabet
from converters.files import process_file
from ui_common import inject_style, system_select

st.set_page_config(
    page_title="Очистка текста — Urmi Text Tools",
    page_icon="🧹",
    layout="wide",
)

inject_style()

st.title("Очистка текста")
st.markdown(
    '<p class="hero-sub">Удаляет из текста все знаки, которые <strong>не</strong> относятся '
    "к выбранному алфавиту. Знак <strong>+</strong> всегда сохраняется. Пробелы, переносы строк "
    "и ударение на гласных по умолчанию сохраняются — каждую опцию можно отключить.</p>",
    unsafe_allow_html=True,
)

mode = st.radio(
    "Режим",
    ["Текст в окне", "Файл"],
    horizontal=True,
    label_visibility="collapsed",
    key="clean_mode",
)

c1, c2 = st.columns([1, 1])
with c1:
    system = system_select("Алфавит", "clean_system", "expedition")
with c2:
    keep_ws = st.checkbox("Сохранять пробелы и переносы строк", value=True, key="keep_ws")
    keep_stress = st.checkbox("Сохранять ударение", value=True, key="keep_stress")

if mode == "Текст в окне":
    left, right = st.columns(2)
    with left:
        st.text_area("Ввод", height=260, placeholder="Вставьте текст…", key="clean_in")
    with right:
        if "clean_out_box" not in st.session_state:
            st.session_state["clean_out_box"] = st.session_state.get("clean_out", "")
        st.text_area("Результат", height=260, key="clean_out_box")

    b1, b2, b3 = st.columns(3)
    with b1:
        if st.button("Очистить текст", type="primary", use_container_width=True):
            out = clean_text(
                st.session_state.get("clean_in", ""),
                system,
                keep_whitespace=keep_ws,
                keep_stress=keep_stress,
            )
            st.session_state["clean_out"] = out
            st.session_state["clean_out_box"] = out
            st.rerun()
    with b2:
        st.download_button(
            "Скачать результат (.txt)",
            data=st.session_state.get("clean_out", "").encode("utf-8"),
            file_name="cleaned.txt",
            mime="text/plain",
            use_container_width=True,
            disabled=not st.session_state.get("clean_out"),
            key="clean_txt_dl",
        )
    with b3:
        if st.button("Сбросить", use_container_width=True, key="clean_reset"):
            st.session_state["clean_out"] = ""
            st.session_state["clean_in"] = ""
            st.session_state["clean_out_box"] = ""
            st.rerun()
else:
    uploaded = st.file_uploader(
        "Загрузите txt, csv, docx, xlsx, pdf или flextext",
        type=["txt", "csv", "docx", "xlsx", "pdf", "flextext", "xml"],
        key="clean_file",
    )
    if st.button(
        "Очистить и скачать",
        type="primary",
        disabled=uploaded is None,
        key="clean_file_btn",
    ):
        assert uploaded is not None
        data = uploaded.getvalue()

        def transform(t: str) -> str:
            return clean_text(
                t,
                system,
                keep_whitespace=keep_ws,
                keep_stress=keep_stress,
            )

        try:
            out, out_name, media = process_file(uploaded.name, data, transform)
        except ValueError as e:
            st.error(str(e))
        else:
            if "_converted" in out_name:
                out_name = out_name.replace("_converted", "_cleaned")
            st.download_button(
                "Скачать результат",
                data=out,
                file_name=out_name,
                mime=media.split(";")[0],
                type="primary",
                key="clean_dl",
            )

st.markdown("Допустимые знаки выбранного алфавита (+ всегда разрешён):")
glyphs = get_alphabet(system, keep_stress=keep_stress) + ["+"]
chips = "".join(f'<span class="chip">{html.escape(g)}</span>' for g in glyphs)
st.markdown(f'<div class="chip-row">{chips}</div>', unsafe_allow_html=True)
