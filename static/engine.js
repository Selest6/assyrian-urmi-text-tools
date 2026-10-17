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
// ь / Ь are the Novyi spelling of /ə/, so an acute can sit on them.
const VOWEL_BASES = new Set([..."aeiouəǝAEIOUƏƎаэиоуыАЭИОУЫьЬ"]);
window.VOWEL_BASES = VOWEL_BASES;

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

function continuesWord(text, i) {
  const ch = text[i];
  if (!ch) return false;
  return /^\p{L}$/u.test(ch) || /\p{M}/u.test(ch);
}

function atWordStart(text, i) {
  if (i <= 0) return true;
  const prev = text[i - 1];
  return prev === PLUS || isWhitespace(prev) || !continuesWord(text, i - 1);
}

function periodIsLetter(text, start, end, moreAfter) {
  // Cereteli tense [p] is "p.". The period is the letter inside a word, when
  // "p." is a whole word, or at the end of the text. Before another word it
  // is sentence punctuation: "brap. slama."
  if (end < text.length && (continuesWord(text, end) || text[end] === ".")) return true;
  let j = end;
  while (j < text.length && text[j] !== PLUS && !isWhitespace(text[j])) return false;
  let followed = moreAfter;
  if (followed == null) {
    let k = j;
    while (k < text.length && (isWhitespace(text[k]) || text[k] === PLUS)) k += 1;
    followed = k < text.length;
  }
  if (atWordStart(text, start)) return true;
  return !followed;
}

function matchAt(text, i, systemId, moreAfter) {
  for (const tok of tokenList(systemId)) {
    if (!text.startsWith(tok, i)) continue;
    const end = i + tok.length;
    if (tok.endsWith(".") && !periodIsLetter(text, i, end, moreAfter)) continue;
    return [tok, end];
  }
  return null;
}

function matchToken(text, i, systemId, moreAfter) {
  let found = matchAt(text, i, systemId, moreAfter);
  if (found) return found;
  const lower = text.slice(0, i) + text.slice(i).toLowerCase();
  found = matchAt(lower, i, systemId, moreAfter);
  if (found) return found;
  const base = stripStress(text[i] || "");
  if (!base || base === text[i]) return null;
  const rewritten = text.slice(0, i) + base + text.slice(i + 1);
  found = matchAt(rewritten, i, systemId, moreAfter);
  if (found) return found;
  const rewrittenLower = rewritten.slice(0, i) + rewritten.slice(i).toLowerCase();
  return matchAt(rewrittenLower, i, systemId, moreAfter);
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

function convertSegment(segment, source, target, moreAfter) {
  const rt = window.URMI_RUNTIME;
  const pieces = [];
  let i = 0;
  while (i < segment.length) {
    const m = matchToken(segment, i, source, moreAfter);
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
    let k = j;
    while (k < s.length && (isWhitespace(s[k]) || s[k] === PLUS)) k += 1;
    out += convertSegment(s.slice(i, j), source, target, k < s.length);
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
    let end = cleanTokenEnd(s, i, tokens);
    if (end == null && keepStress) {
      const grapheme = graphemeAt(s, i);
      const base = stripStress(grapheme);
      if (base && base !== grapheme && cleanTokenEnd(base, 0, tokens) === base.length) {
        out += lowercase ? grapheme.toLowerCase() : grapheme;
        i += grapheme.length;
        continue;
      }
    }
    if (end == null) {
      i += 1;
      continue;
    }
    if (keepStress) {
      while (end < s.length && s[end] === "\u0301") end += 1;
    }
    let piece = s.slice(i, end);
    if (!keepStress) piece = stripStress(piece);
    if (lowercase) piece = piece.toLowerCase();
    out += piece;
    i = end;
  }
  return normalizeWhitespace ? collapseWhitespace(out) : out;
}

function graphemeAt(text, i) {
  let j = i + 1;
  while (j < text.length && /\p{M}/u.test(text[j])) j += 1;
  return text.slice(i, j);
}

function cleanTokenEnd(text, i, tokens) {
  if (i >= text.length) return null;
  const lower = text.slice(i).toLowerCase();
  for (const tok of tokens) {
    if (text.startsWith(tok, i) || lower.startsWith(tok)) {
      const end = i + tok.length;
      if (tok.endsWith(".") && !periodIsLetter(text, i, end, null)) continue;
      return end;
    }
  }
  return null;
}

function collapseWhitespace(text) {
  let out = "";
  let prev = false;
  for (const ch of text) {
    if (isWhitespace(ch)) {
      if (!prev) out += " ";
      prev = true;
    } else {
      prev = false;
      out += ch;
    }
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
    const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) node.nodeValue = transformFn(node.nodeValue || "");
  });
  let outText = new XMLSerializer().serializeToString(doc);
  if (!outText.startsWith("<?xml")) {
    outText = '<?xml version="1.0" encoding="UTF-8"?>\n' + outText;
  }
  return outText;
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("Браузер не умеет читать сжатый DOCX");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const start = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= start; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Не удалось прочитать DOCX");
  const count = view.getUint16(eocd + 10, true);
  let central = view.getUint32(eocd + 16, true);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (view.getUint32(central, true) !== 0x02014b50) throw new Error("Не удалось прочитать DOCX");
    const method = view.getUint16(central + 10, true);
    const compSize = view.getUint32(central + 20, true);
    const nameLen = view.getUint16(central + 28, true);
    const extraLen = view.getUint16(central + 30, true);
    const commentLen = view.getUint16(central + 32, true);
    const localOff = view.getUint32(central + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(central + 46, central + 46 + nameLen));
    const nameLenLocal = view.getUint16(localOff + 26, true);
    const extraLenLocal = view.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + nameLenLocal + extraLenLocal;
    const compressed = bytes.subarray(dataStart, dataStart + compSize);
    let data;
    if (method === 0) data = compressed;
    else if (method === 8) data = await inflateRaw(compressed);
    else throw new Error("Не удалось прочитать DOCX");
    if (!name.endsWith("/")) files[name] = data;
    central += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function paragraphAncestor(node) {
  let p = node.parentNode;
  while (p && p.localName !== "p") p = p.parentNode;
  return p;
}

function setDocxText(node, value) {
  node.textContent = value;
  if (/^\s|\s$/.test(value || "")) {
    node.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  }
}

function transformDocxXml(xml, transformFn) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Не удалось прочитать DOCX");
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const nodes = [...doc.getElementsByTagNameNS(W, "t")];
  const groups = new Map();
  for (const node of nodes) {
    const key = paragraphAncestor(node) || node;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }
  for (const group of groups.values()) {
    const texts = group.map((node) => node.textContent || "");
    const joined = texts.join("");
    if (!joined) continue;
    const separate = texts.map((value) => (value ? transformFn(value) : "")).join("");
    const converted = transformFn(joined);
    if (converted === separate) {
      group.forEach((node, index) => {
        if (!texts[index]) return;
        setDocxText(node, transformFn(texts[index]));
      });
    } else {
      setDocxText(group[0], converted);
      for (let index = 1; index < group.length; index++) {
        if (texts[index]) group[index].textContent = "";
      }
    }
  }
  let out = new XMLSerializer().serializeToString(doc);
  if (!out.startsWith("<?xml")) {
    out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + out;
  }
  return out;
}

async function transformDocxBuffer(buffer, transformFn) {
  const files = await unzip(buffer);
  const names = Object.keys(files).filter((name) => /^word\/.+\.xml$/i.test(name));
  if (!names.length) throw new Error("Не удалось прочитать DOCX");
  const decoder = new TextDecoder("utf-8");
  const encoder = new TextEncoder();
  for (const name of names) {
    const xml = decoder.decode(files[name]);
    if (!xml.includes("<w:t")) continue;
    files[name] = encoder.encode(transformDocxXml(xml, transformFn));
  }
  return zipStore(files);
}

function pdfItemsToText(items) {
  let text = "";
  let prev = null;
  for (const it of items || []) {
    if (!it || typeof it.str !== "string" || it.str === "") continue;
    if (prev) {
      const y = it.transform ? it.transform[5] : 0;
      const py = prev.transform ? prev.transform[5] : 0;
      const h = Math.max(it.height || 0, prev.height || 0, 1);
      const newLine = prev.hasEOL || Math.abs(y - py) > h * 0.6;
      if (newLine) {
        if (!text.endsWith("\n")) text += "\n";
      } else {
        const x = it.transform ? it.transform[4] : 0;
        const px = prev.transform ? prev.transform[4] : 0;
        const gap = x - (px + (prev.width || 0));
        if (gap > h * 0.15 && !prev.str.endsWith(" ") && !it.str.startsWith(" ")) text += " ";
      }
    }
    text += it.str;
    prev = it;
  }
  return text;
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
    const buf = await file.arrayBuffer();
    const bytes = await transformDocxBuffer(buf, transformFn);
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
      parts.push(pdfItemsToText(content.items));
    }
    const converted = transformFn(parts.join("\n"));
    const outBlob = await buildPdfBlob(converted);
    return {
      blob: outBlob,
      name: `${stem}_${suffix}.pdf`,
    };
  }

  throw new Error("Неподдерживаемый формат");
}

function arrayBufferToBinaryString(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return binary;
}

function loadPdfUnicodeFont() {
  if (window._urmiPdfFontBinary) return window._urmiPdfFontBinary;
  const b64 = window.URMI_PDF_FONT_B64;
  if (!b64) throw new Error("Не удалось загрузить шрифт для PDF");
  const binary = atob(b64);
  window._urmiPdfFontBinary = binary;
  return binary;
}

async function buildPdfBlob(text) {
  const jspdfNS = window.jspdf;
  if (!jspdfNS || !jspdfNS.jsPDF) {
    throw new Error("Не удалось загрузить обработчик PDF (запись)");
  }
  const fontBinary = await loadPdfUnicodeFont();
  const doc = new jspdfNS.jsPDF({ unit: "pt", format: "a4" });
  const fontFile = "DejaVuSans.ttf";
  const fontName = "DejaVuSans";
  doc.addFileToVFS(fontFile, fontBinary);
  doc.addFont(fontFile, fontName, "normal");
  doc.setFont(fontName, "normal");
  doc.setFontSize(11);

  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  const lineHeight = 14;
  let y = margin + 8;
  const paragraphs = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph.length ? paragraph : " ", maxWidth);
    for (const line of lines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        doc.setFont(fontName, "normal");
        doc.setFontSize(11);
        y = margin + 8;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  return doc.output("blob");
}
