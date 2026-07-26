# Urmi Text Tools

Конвертеры письменностей и очистка текста для христианского урмийского (раскладка экспедиции, Khan 2016, Церетели 1964, «Новый алфавит», кириллица).

## Streamlit Cloud

1. Создайте репозиторий на GitHub и загрузите эту папку.
2. Откройте [share.streamlit.io](https://share.streamlit.io) → **New app**.
3. Укажите репозиторий, ветку `main`, файл: `streamlit_app.py`.
4. Deploy.

## Локальный запуск

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

## Страницы

- **streamlit_app.py** (главная) — конвертеры письменностей
- **Cleaner** (в боковом меню) — очистка текста по выбранному алфавиту

Знак `+` всегда сохраняется. Файлы: txt, csv, docx, xlsx, pdf, flextext.
