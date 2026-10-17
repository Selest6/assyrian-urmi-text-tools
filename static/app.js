/* UI logic for converters + cleaner (client-side, Streamlit-embeddable) */

function byId(root, id) {
  return root.querySelector("#" + id);
}

function toast(root, msg) {
  const el = byId(root, "toast");
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

function wireModeTabs(root) {
  const tabs = root.querySelectorAll(".mode-tabs button");
  const textPanel = byId(root, "textPanel");
  const filePanel = byId(root, "filePanel");
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

function pageFromLocation() {
  const path = (location.pathname || "").toLowerCase();
  return path.includes("clean") ? "cleaner" : "converters";
}

function showPage(name, updateUrl) {
  const pages = document.querySelectorAll(".urmi-page");
  if (!pages.length) return;
  pages.forEach((el) => {
    el.hidden = el.dataset.page !== name;
  });
  const scroller = document.querySelector('[data-testid="stMain"]');
  if (scroller) scroller.scrollTop = 0;
  if (!updateUrl || !window.URMI_NAV) return;
  const url = window.URMI_NAV[name] || "/";
  if (location.pathname !== url) history.pushState({ urmiPage: name }, "", url);
}

function applyNav() {
  document.querySelectorAll("[data-nav]").forEach((a) => {
    if (a.dataset.bound === "1") return;
    a.dataset.bound = "1";
    a.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        showPage(a.dataset.nav, true);
      },
      true
    );
  });
  if (!window._urmiPopstate) {
    window._urmiPopstate = true;
    window.addEventListener("popstate", () => showPage(pageFromLocation(), false));
    showPage(pageFromLocation(), false);
  }
}

function wireFileName(root) {
  const input = byId(root, "fileInput");
  const name = byId(root, "fileName");
  if (!input || !name || input.dataset.bound === "1") return;
  input.dataset.bound = "1";
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    name.textContent = file ? file.name : "";
  });
}

function renderTable(root, table) {
  const head = byId(root, "tableHead");
  const body = byId(root, "tableBody");
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

function stressGlyph(base) {
  let out = "";
  let done = false;
  for (const ch of base.normalize("NFD")) {
    out += ch;
    if (!done && !/\p{M}/u.test(ch)) {
      out += "\u0301";
      done = true;
    }
  }
  return out.normalize("NFC");
}

function renderAlphabet(root, systemId) {
  const box = byId(root, "alphabetChips");
  const meta = window.URMI_RUNTIME;
  if (!meta || !box) return;
  const keepStressEl = byId(root, "keepStress");
  let glyphs =
    keepStressEl && !keepStressEl.checked
      ? meta.alphabets_nostress[systemId] || []
      : meta.alphabets[systemId] || [];
  if (!keepStressEl || keepStressEl.checked) {
    const vowels = window.VOWEL_BASES || new Set();
    const seen = new Set(glyphs);
    const extra = [];
    for (const g of glyphs) {
      const bare = stripStressJs(g);
      if (bare !== g) continue;
      if (![...bare].some((ch) => vowels.has(ch))) continue;
      const stressed = stressGlyph(bare);
      if (!seen.has(stressed)) {
        seen.add(stressed);
        extra.push(stressed);
      }
    }
    glyphs = glyphs.concat(extra);
  }
  box.innerHTML =
    glyphs.map((g) => `<span class="chip">${escapeHtml(g)}</span>`).join("") +
    `<span class="chip">+</span>`;
}

function loadCdnLibs() {
  const urls = [
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
  const root = document.querySelector('.urmi-page[data-page="converters"]') || document;
  applyNav();
  const meta = window.URMI_RUNTIME;
  const source = byId(root, "source");
  const target = byId(root, "targetSystem");
  fillSystemSelect(source, meta.systems, "expedition");
  fillSystemSelect(target, meta.systems, "khan");
  wireModeTabs(root);
  wireFileName(root);
  renderTable(root, meta.table);
  loadCdnLibs();

  byId(root, "swapBtn").addEventListener("click", () => {
    const a = source.value;
    source.value = target.value;
    target.value = a;
  });

  byId(root, "convertBtn").addEventListener("click", () => {
    byId(root, "output").value = convertText(byId(root, "input").value, source.value, target.value);
    toast(root, "Готово");
  });

  byId(root, "copyBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(byId(root, "output").value);
    toast(root, "Скопировано");
  });

  byId(root, "clearBtn").addEventListener("click", () => {
    byId(root, "input").value = "";
    byId(root, "output").value = "";
  });

  byId(root, "convertFileBtn").addEventListener("click", async () => {
    const input = byId(root, "fileInput");
    if (!input.files || !input.files[0]) {
      toast(root, "Выберите файл");
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
      toast(root, "Файл скачан");
    } catch (e) {
      toast(root, e.message || "Ошибка обработки файла");
    }
  });
}

function initCleanerPage() {
  const root = document.querySelector('.urmi-page[data-page="cleaner"]') || document;
  applyNav();
  const meta = window.URMI_RUNTIME;
  const system = byId(root, "system");
  const keepStress = byId(root, "keepStress");
  fillSystemSelect(system, meta.systems, "expedition");
  wireModeTabs(root);
  wireFileName(root);
  renderAlphabet(root, system.value);
  loadCdnLibs();

  system.addEventListener("change", () => renderAlphabet(root, system.value));
  keepStress.addEventListener("change", () => renderAlphabet(root, system.value));

  byId(root, "cleanBtn").addEventListener("click", () => {
    byId(root, "output").value = cleanText(
      byId(root, "input").value,
      system.value,
      byId(root, "normalizeWs").checked,
      keepStress.checked,
      byId(root, "lowercase").checked
    );
    toast(root, "Готово");
  });

  byId(root, "copyBtn").addEventListener("click", async () => {
    await navigator.clipboard.writeText(byId(root, "output").value);
    toast(root, "Скопировано");
  });

  byId(root, "clearBtn").addEventListener("click", () => {
    byId(root, "input").value = "";
    byId(root, "output").value = "";
  });

  byId(root, "cleanFileBtn").addEventListener("click", async () => {
    const input = byId(root, "fileInput");
    if (!input.files || !input.files[0]) {
      toast(root, "Выберите файл");
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
            byId(root, "normalizeWs").checked,
            keepStress.checked,
            byId(root, "lowercase").checked
          ),
        "cleaned"
      );
      downloadBlob(blob, name);
      toast(root, "Файл скачан");
    } catch (e) {
      toast(root, e.message || "Ошибка обработки файла");
    }
  });
}
