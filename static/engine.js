/* Browser port of converters.engine — keeps '+' intact */

const PLUS = "+";

function nfc(s) {
  return (s || "").normalize("NFC");
}

function stripStress(text) {
  return nfc(text)
    .normalize("NFD")
    .replace(/\u0301/g, "")
    .normalize("NFC");
}

function isWhitespace(ch) {
  return /\s/.test(ch) || /[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/.test(ch);
}

function tokenList(systemId) {
  const map = window.URMI_RUNTIME.to_hub[systemId] || {};
  return Object.keys(map).sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
}

function matchToken(text, i, systemId) {
  const lower = text.slice(0, i) + text.slice(i).toLowerCase();
  for (const src of [text, lower]) {
    for (const tok of tokenList(systemId)) {
      if (src.startsWith(tok, i)) return [tok, i + tok.length];
    }
  }
  return null;
}

function convertText(text, source, target) {
  const rt = window.URMI_RUNTIME;
  if (!text) return text;
  if (source === target) return text;
  const s = nfc(text);
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === PLUS) {
      out += PLUS;
      i += 1;
      continue;
    }
    if (isWhitespace(ch)) {
      out += ch;
      i += 1;
      continue;
    }
    const m = matchToken(s, i, source);
    if (!m) {
      out += ch;
      i += 1;
      continue;
    }
    const [tok, end] = m;
    const hubIdx = String(rt.to_hub[source][tok]);
    const targetForm = (rt.from_hub[hubIdx] || {})[target];
    out += targetForm != null ? targetForm : tok;
    i = end;
  }
  return out;
}

function cleanText(text, systemId, keepWhitespace = true, keepStress = true) {
  if (!text) return text;
  let s = nfc(text);
  if (!keepStress) s = stripStress(s);

  let tokens = tokenList(systemId);
  if (!keepStress) {
    const seen = new Set();
    tokens = tokens
      .map(stripStress)
      .filter((t) => {
        if (!t || seen.has(t)) return false;
        seen.add(t);
        return true;
      })
      .sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
  }

  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === PLUS) {
      out += PLUS;
      i += 1;
      continue;
    }
    if (keepWhitespace && isWhitespace(ch)) {
      out += ch;
      i += 1;
      continue;
    }
    const lower = s.slice(i).toLowerCase();
    let matched = false;
    for (const tok of tokens) {
      if (s.startsWith(tok, i) || lower.startsWith(tok)) {
        const piece = s.slice(i, i + tok.length);
        out += keepStress ? piece : stripStress(piece);
        i += tok.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }
  return out;
}

async function transformFile(file, transformFn, suffix) {
  const name = file.name || "file.txt";
  const lower = name.toLowerCase();
  const stem = name.replace(/\.[^.]+$/, "");
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : ".txt";

  // Text-like formats: full round-trip in the browser
  if ([".txt", ".csv", ".flextext", ".xml"].includes(ext)) {
    const raw = await file.text();
    let outText;
    let outName;
    let mime;
    if (ext === ".csv") {
      outText = raw
        .split(/\r?\n/)
        .map((line) => {
          // naive CSV cell split respecting quotes poorly — good enough for simple sheets
          return line
            .split(",")
            .map((cell) => transformFn(cell))
            .join(",");
        })
        .join("\n");
      outName = `${stem}_${suffix}.csv`;
      mime = "text/csv;charset=utf-8";
    } else if (ext === ".flextext" || ext === ".xml") {
      try {
        const doc = new DOMParser().parseFromString(raw, "application/xml");
        if (doc.querySelector("parsererror")) throw new Error("parse");
        const types = new Set(["txt", "gls", "lit", "note", "title"]);
        doc.querySelectorAll("*").forEach((el) => {
          const tag = el.tagName.toLowerCase();
          if (tag === "item") {
            const t = (el.getAttribute("type") || "").toLowerCase();
            if (!t || types.has(t)) {
              if (el.textContent) el.textContent = transformFn(el.textContent);
            }
          } else if (["word", "phrase", "sentence", "paragraph", "text"].includes(tag)) {
            if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
              el.textContent = transformFn(el.textContent);
            }
          }
        });
        outText = new XMLSerializer().serializeToString(doc);
        if (!outText.startsWith("<?xml")) {
          outText = '<?xml version="1.0" encoding="UTF-8"?>\n' + outText;
        }
        outName = `${stem}_${suffix}.flextext`;
        mime = "application/xml;charset=utf-8";
      } catch {
        outText = transformFn(raw);
        outName = `${stem}_${suffix}.txt`;
        mime = "text/plain;charset=utf-8";
      }
    } else {
      outText = transformFn(raw);
      outName = `${stem}_${suffix}.txt`;
      mime = "text/plain;charset=utf-8";
    }
    return { blob: new Blob([outText], { type: mime }), name: outName };
  }

  // Binary office/PDF: extract text best-effort, return .txt
  // (full binary rewrite needs a Python backend; text download keeps the UI working)
  let text = "";
  if (ext === ".docx") {
    if (!window.mammoth) throw new Error("Не удалось загрузить обработчик DOCX");
    const buf = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
    text = result.value || "";
  } else if (ext === ".xlsx") {
    if (!window.XLSX) throw new Error("Не удалось загрузить обработчик XLSX");
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: "array" });
    const parts = [];
    wb.SheetNames.forEach((sn) => {
      const sheet = wb.Sheets[sn];
      parts.push(window.XLSX.utils.sheet_to_csv(sheet));
    });
    text = parts.join("\n");
  } else if (ext === ".pdf") {
    if (!window.pdfjsLib) throw new Error("Не удалось загрузить обработчик PDF");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const parts = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => it.str).join(" "));
    }
    text = parts.join("\n");
  } else {
    throw new Error("Неподдерживаемый формат");
  }
  const converted = transformFn(text);
  return {
    blob: new Blob([converted], { type: "text/plain;charset=utf-8" }),
    name: `${stem}_${suffix}.txt`,
  };
}
