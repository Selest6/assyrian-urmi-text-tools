/* UI logic for converters + cleaner (client-side, Streamlit-embeddable) */

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

function fillSystemSelect(selectEl, systems, preferredId) {
  selectEl.innerHTML = "";
  for (const s of systems) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    selectEl.appendChild(opt);
  }
  if (preferredId) selectEl.value = preferredId;
}

function wireModeTabs() {
  const tabs = document.querySelectorAll(".mode-tabs button");
  const textPanel = document.getElementById("textPanel");
  const filePanel = document.getElementById("filePanel");
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const mode = btn.dataset.mode;
      textPanel.classList.toggle("active", mode === "text");
      filePanel.classList.toggle("active", mode === "file");
    });
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function applyNav() {
  const nav = window.URMI_NAV || {};
  const routes = {
    converters: nav.converters || "/",
    cleaner: nav.cleaner || "/Cleaner",
  };
  document.querySelectorAll("[data-nav]").forEach((a) => {
    const url = routes[a.dataset.nav];
    if (!url) return;
    a.href = url;
    a.target = "_self";
    a.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.assign(url);
    });
  });
}

function renderTable(table) {
  const head = document.getElementById("tableHead");
  const body = document.getElementById("tableBody");
  if (!head || !body) return;
  const cols = [
    { key: "expedition", label: "Раскладка экспедиции" },
    { key: "khan", label: "Khan 2016" },
    { key: "cereteli", label: "Церетели 1964" },
    { key: "novyi", label: "«Новый алфавит»" },
    { key: "cyrillic", label: "Кириллица" },
    { key: "pron", label: "Произносится" },
    { key: "layout", label: "Клавиатурная раскладка" },
    { key: "assyrian", label: "Буква ассирийского алфавита" },
  ];
  head.innerHTML = cols.map((c) => `<th>${c.label}</th>`).join("");

  let lastCat = null;
  const frag = document.createDocumentFragment();
  for (const row of table.rows) {
    if (row.category !== lastCat) {
      lastCat = row.category;
      const trCat = document.createElement("tr");
      trCat.className = "cat-row";
      trCat.innerHTML = `<td colspan="${cols.length}">${escapeHtml(row.category)}</td>`;
      frag.appendChild(trCat);
    }
    const tr = document.createElement("tr");
    tr.innerHTML = cols
      .map((c) => {
        const val = row[c.key] ?? "";
        const cls = ["expedition", "khan", "cereteli", "novyi", "cyrillic"].includes(c.key)
          ? ' class="glyph"'
          : "";
        return `<td${cls}>${escapeHtml(String(val))}</td>`;
      })
      .join("");
    frag.appendChild(tr);
  }
  body.innerHTML = "";
  body.appendChild(frag);
}

function stripStressJs(s) {
  return s.normalize("NFD").replace(/\u0301/g, "").normalize("NFC");
}

function renderAlphabet(systemId) {
  const box = document.getElementById("alphabetChips");
  const meta = window.URMI_RUNTIME;
  if (!meta || !box) return;
  const keepStressEl = document.getElementById("keepStress");
  let glyphs =
    keepStressEl && !keepStressEl.checked
      ? meta.alphabets_nostress[systemId] || []
      : meta.alphabets[systemId] || [];
  box.innerHTML =
    glyphs.map((g) => `<span class="chip">${escapeHtml(g)}</span>`).join("") +
    `<span class="chip">+</span>`;
}

function loadCdnLibs() {
  const urls = [
    "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.8.0/mammoth.browser.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  ];
  return Promise.all(
    urls.map(
      (src) =>
        new Promise((resolve) => {
          if ([...document.scripts].some((s) => s.src === src)) {
            resolve();
            return;
          }
          const el = document.createElement("script");
          el.src = src;
          el.onload = () => resolve();
          el.onerror = () => resolve();
          document.head.appendChild(el);
        })
    )
  ).then(() => {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  });
}

function initConvertersPage() {
  applyNav();
  const meta = window.URMI_RUNTIME;
  const source = document.getElementById("source");
  const target = document.getElementById("targetSystem");
  fillSystemSelect(source, meta.systems, "expedition");
  fillSystemSelect(target, meta.systems, "khan");
  wireModeTabs();
  renderTable(meta.table);
  loadCdnLibs();

  document.getElementById("swapBtn").addEventListener("click", () => {
    const a = source.value;
    source.value = target.value;
    target.value = a;
  });

  document.getElementById("convertBtn").addEventListener("click", () => {
    const text = document.getElementById("input").value;
    document.getElementById("output").value = convertText(text, source.value, target.value);
    toast("Готово");
  });

  document.getElementById("copyBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.getElementById("output").value);
    toast("Скопировано");
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    document.getElementById("input").value = "";
    document.getElementById("output").value = "";
  });

  document.getElementById("convertFileBtn").addEventListener("click", async () => {
    const input = document.getElementById("fileInput");
    if (!input.files || !input.files[0]) {
      toast("Выберите файл");
      return;
    }
    const file = input.files[0];
    try {
      await loadCdnLibs();
      const { blob, name } = await transformFile(
        file,
        (t) => convertText(t, source.value, target.value),
        "converted"
      );
      downloadBlob(blob, name);
      if (name.endsWith(".txt") && !file.name.toLowerCase().endsWith(".txt")) {
        toast("Скачан текст (.txt) — бинарный формат упрощён");
      } else {
        toast("Файл скачан");
      }
    } catch (e) {
      toast(e.message || "Ошибка обработки файла");
    }
  });
}

function initCleanerPage() {
  applyNav();
  const meta = window.URMI_RUNTIME;
  const system = document.getElementById("system");
  const keepStress = document.getElementById("keepStress");
  fillSystemSelect(system, meta.systems, "expedition");
  wireModeTabs();
  renderAlphabet(system.value);
  loadCdnLibs();

  system.addEventListener("change", () => renderAlphabet(system.value));
  keepStress.addEventListener("change", () => renderAlphabet(system.value));

  document.getElementById("cleanBtn").addEventListener("click", () => {
    document.getElementById("output").value = cleanText(
      document.getElementById("input").value,
      system.value,
      document.getElementById("keepWs").checked,
      keepStress.checked
    );
    toast("Готово");
  });

  document.getElementById("copyBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.getElementById("output").value);
    toast("Скопировано");
  });

  document.getElementById("clearBtn").addEventListener("click", () => {
    document.getElementById("input").value = "";
    document.getElementById("output").value = "";
  });

  document.getElementById("cleanFileBtn").addEventListener("click", async () => {
    const input = document.getElementById("fileInput");
    if (!input.files || !input.files[0]) {
      toast("Выберите файл");
      return;
    }
    try {
      await loadCdnLibs();
      const { blob, name } = await transformFile(
        input.files[0],
        (t) =>
          cleanText(
            t,
            system.value,
            document.getElementById("keepWs").checked,
            keepStress.checked
          ),
        "cleaned"
      );
      downloadBlob(blob, name);
      toast("Файл скачан");
    } catch (e) {
      toast(e.message || "Ошибка обработки файла");
    }
  });
}
