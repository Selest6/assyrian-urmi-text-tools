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

const GAMMA_APOSTROPHES = new Set(["'", "\u2019", "\u2018", "\u02bc"]);
const VOWEL_BASES = new Set([..."aeiouəǝAEIOUƏƎаэиоуыАЭИОУЫ"]);

function foldGammaApostrophe(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const nxt = text[i + 1] || "";
    if ((ch === "г" || ch === "Г") && GAMMA_APOSTROPHES.has(nxt)) {
      out += ch + "'";
      i += 1;
      continue;
    }
    out += ch;
  }
  return out;
}

function isLetter(ch) {
  return /^\p{L}$/u.test(ch);
}

function isUpperLetter(ch) {
  return isLetter(ch) && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
}

function applyCase(sourceSlice, target) {
  const letters = [...stripStress(sourceSlice)].filter(isLetter);
  if (!letters.length) return target;
  if (letters.every(isUpperLetter)) return target.toUpperCase();
  if (isUpperLetter(letters[0]) && letters.slice(1).every((ch) => !isUpperLetter(ch))) {
    const chars = [...target];
    for (let i = 0; i < chars.length; i++) {
      if (isLetter(chars[i])) {
        chars[i] = chars[i].toUpperCase();
        return chars.join("");
      }
    }
  }
  return target;
}

function applyStress(sourceSlice, target) {
  if (!sourceSlice.normalize("NFD").includes("\u0301")) return target;
  if (target.normalize("NFD").includes("\u0301")) return target;
  if (![...target].some((ch) => VOWEL_BASES.has(stripStress(ch)))) return target;
  const nfd = target.normalize("NFD");
  let out = "";
  let inserted = false;
  for (const ch of nfd) {
    out += ch;
    if (!inserted && !/\p{M}/u.test(ch)) {
      out += "\u0301";
      inserted = true;
    }
  }
  return out.normalize("NFC");
}

function matchAt(text, i, systemId) {
  for (const tok of tokenList(systemId)) {
    if (text.startsWith(tok, i)) return [tok, i + tok.length];
  }
  return null;
}

function matchToken(text, i, systemId) {
  let found = matchAt(text, i, systemId);
  if (found) return found;
  const lower = text.slice(0, i) + text.slice(i).toLowerCase();
  found = matchAt(lower, i, systemId);
  if (found) return found;
  const base = stripStress(text[i] || "");
  if (!base || base === text[i]) return null;
  const rewritten = text.slice(0, i) + base + text.slice(i + 1);
  found = matchAt(rewritten, i, systemId);
  if (found) return found;
  const rewrittenLower = rewritten.slice(0, i) + rewritten.slice(i).toLowerCase();
  return matchAt(rewrittenLower, i, systemId);
}

function wordCase(letters) {
  if (!letters.length) return "lower";
  if (letters.every(isUpperLetter)) return letters.length === 1 ? "title" : "upper";
  if (isUpperLetter(letters[0]) && letters.slice(1).every((ch) => !isUpperLetter(ch))) return "title";
  return "mixed";
}

function upperFirstLetter(text) {
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    if (isLetter(chars[i])) {
      chars[i] = chars[i].toUpperCase();
      return chars.join("");
    }
  }
  return text;
}

function convertSegment(segment, source, target) {
  const rt = window.URMI_RUNTIME;
  const pieces = [];
  let i = 0;
  while (i < segment.length) {
    const m = matchToken(segment, i, source);
    if (!m) {
      pieces.push({ raw: segment[i] });
      i += 1;
      continue;
    }
    const [tok, end] = m;
    const original = segment.slice(i, end);
    const hubIdx = String(rt.to_hub[source][tok]);
    const targetForm = (rt.from_hub[hubIdx] || {})[target];
    if (targetForm == null) pieces.push({ raw: original });
    else pieces.push({ target: targetForm, original, stress: original.normalize("NFD").includes("\u0301") });
    i = end;
  }
  const letters = [];
  for (const piece of pieces) letters.push(...casedLetters(piece.original || piece.raw || ""));
  const pattern = wordCase(letters);
  let out = "";
  for (const piece of pieces) {
    if (piece.raw != null) {
      out += piece.raw;
      continue;
    }
    let chunk = piece.target;
    if (pattern === "upper") chunk = chunk.toUpperCase();
    else if (pattern === "mixed") chunk = applyCase(piece.original, chunk);
    if (piece.stress) chunk = applyStress(piece.original, chunk);
    out += chunk;
  }
  if (pattern === "title") out = upperFirstLetter(out);
  return out;
}

function casedLetters(text) {
  return [...stripStress(text)].filter(isLetter);
}

function convertText(text, source, target) {
  if (!text) return text;
  if (source === target) return text;
  const s = foldGammaApostrophe(nfc(text));
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === PLUS || isWhitespace(ch)) {
      out += ch;
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < s.length && s[j] !== PLUS && !isWhitespace(s[j])) j += 1;
    out += convertSegment(s.slice(i, j), source, target);
    i = j;
  }
  return out.normalize("NFC");
}

function cleanText(text, systemId, normalizeWhitespace = false, keepStress = true, lowercase = false) {
  if (!text) return text;
  let s = foldGammaApostrophe(nfc(text));
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
    if (isWhitespace(ch)) {
      if (normalizeWhitespace) {
        while (i < s.length && isWhitespace(s[i])) i += 1;
        out += " ";
      } else {
        out += ch;
        i += 1;
      }
      continue;
    }
    const lower = s.slice(i).toLowerCase();
    let matched = false;
    for (const tok of tokens) {
      if (s.startsWith(tok, i) || lower.startsWith(tok)) {
        let piece = s.slice(i, i + tok.length);
        if (!keepStress) piece = stripStress(piece);
        if (lowercase) piece = piece.toLowerCase();
        out += piece;
        i += tok.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }
  return out;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function escapeCsvCell(value) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function crc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function u16(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}

function u32(n) {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

function concatBytes(parts) {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function zipStore(files) {
  const enc = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = enc.encode(name);
    const data = typeof content === "string" ? enc.encode(content) : content;
    const crc = crc32(data);
    const local = concatBytes([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ]);
    const central = concatBytes([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }
  const centralDir = concatBytes(centrals);
  const end = concatBytes([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centrals.length),
    u16(centrals.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);
  return concatBytes([...locals, centralDir, end]);
}

function escapeXml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildSimpleDocx(text) {
  const body = String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) =>
      line === ""
        ? "<w:p/>"
        : `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr/></w:body>
</w:document>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  return zipStore({
    "[Content_Types].xml": contentTypes,
    "_rels/.rels": rels,
    "word/document.xml": document,
  });
}

function transformFlextextXml(raw, transformFn) {
  const doc = new DOMParser().parseFromString(raw, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("parse");
  doc.querySelectorAll("*").forEach((el) => {
    if (el.tagName.toLowerCase() !== "item") return;
    if ((el.getAttribute("type") || "").toLowerCase() !== "txt") return;
    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
      el.textContent = transformFn(el.textContent || "");
    } else if (el.childNodes.length === 0 && el.textContent) {
      el.textContent = transformFn(el.textContent);
    } else if (![...el.childNodes].some((n) => n.nodeType === 1) && el.textContent) {
      el.textContent = transformFn(el.textContent);
    }
  });
  let outText = new XMLSerializer().serializeToString(doc);
  if (!outText.startsWith("<?xml")) {
    outText = '<?xml version="1.0" encoding="UTF-8"?>\n' + outText;
  }
  return outText;
}

async function transformFile(file, transformFn, suffix) {
  const name = file.name || "file.txt";
  const lower = name.toLowerCase();
  const stem = name.replace(/\.[^.]+$/, "");
  const ext = lower.includes(".") ? lower.slice(lower.lastIndexOf(".")) : ".txt";

  if (ext === ".txt") {
    const raw = await file.text();
    return {
      blob: new Blob([transformFn(raw)], { type: "text/plain;charset=utf-8" }),
      name: `${stem}_${suffix}.txt`,
    };
  }

  if (ext === ".csv") {
    const raw = await file.text();
    const outText = parseCsvRows(raw)
      .map((row) => row.map((cell) => escapeCsvCell(transformFn(cell))).join(","))
      .join("\n");
    return {
      blob: new Blob([outText], { type: "text/csv;charset=utf-8" }),
      name: `${stem}_${suffix}.csv`,
    };
  }

  if (ext === ".flextext" || ext === ".xml") {
    const raw = await file.text();
    try {
      const outText = transformFlextextXml(raw, transformFn);
      return {
        blob: new Blob([outText], { type: "application/xml;charset=utf-8" }),
        name: `${stem}_${suffix}${ext}`,
      };
    } catch {
      return {
        blob: new Blob([transformFn(raw)], { type: "text/plain;charset=utf-8" }),
        name: `${stem}_${suffix}.txt`,
      };
    }
  }

  if (ext === ".docx") {
    if (!window.mammoth) throw new Error("Не удалось загрузить обработчик DOCX");
    const buf = await file.arrayBuffer();
    const result = await window.mammoth.extractRawText({ arrayBuffer: buf });
    const text = String(result.value || "").replace(/(?:\r?\n)+$/g, "");
    const bytes = buildSimpleDocx(transformFn(text));
    return {
      blob: new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
      name: `${stem}_${suffix}.docx`,
    };
  }

  if (ext === ".xlsx") {
    if (!window.XLSX) throw new Error("Не удалось загрузить обработчик XLSX");
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: "array" });
    wb.SheetNames.forEach((sn) => {
      const sheet = wb.Sheets[sn];
      if (!sheet || !sheet["!ref"]) return;
      const range = window.XLSX.utils.decode_range(sheet["!ref"]);
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = window.XLSX.utils.encode_cell({ r: R, c: C });
          const cell = sheet[addr];
          if (!cell || typeof cell.v !== "string") continue;
          cell.v = transformFn(cell.v);
          delete cell.w;
        }
      }
    });
    const out = window.XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return {
      blob: new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      name: `${stem}_${suffix}.xlsx`,
    };
  }

  if (ext === ".pdf") {
    if (!window.pdfjsLib) throw new Error("Не удалось загрузить обработчик PDF");
    const buf = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    const parts = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => it.str).join(" "));
    }
    const converted = transformFn(parts.join("\n"));
    return {
      blob: new Blob([converted], { type: "text/plain;charset=utf-8" }),
      name: `${stem}_${suffix}.txt`,
    };
  }

  throw new Error("Неподдерживаемый формат");
}
