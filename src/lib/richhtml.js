// Conversión entre las marcas de richtext.js y HTML (TipTap) — el puente del
// editor Notion (NotionField). Sin DOM: un solo code path para jest-expo,
// nativo y web. Reusa parseRich (única implementación marcas→spans de la app;
// richtext.js NO se toca).
//
// Convenciones SOBRE el formato de marcas (parseRich las ve como texto plano,
// así las tarjetas viejas y el render de estudio no cambian):
//   - línea "---"        ↔ <hr>   (divisor)
//   - líneas "N. texto"  ↔ <ol>   (lista numerada; la numeración se regenera)
//   - "→" es un carácter literal (el atajo "->" lo inserta el editor)
//
// Limitaciones heredadas (documentadas, no resolubles sin cambiar richtext.js):
//   - negrita+cursiva SOLAS en el mismo tramo no son expresables (***a***
//     se parsea mal): al volver a marcas se conserva bold y se descarta italic
//     (idempotente). Con otra marca en el medio sí se expresa: **__*a*__**.
//   - texto literal con secuencias de marcador (ej. "2**3") se reinterpreta
//     al recargar — el formato no tiene escape, igual que hoy.

import { ALIGN_BY_CHAR, ALIGN_SENTINELS, IMG_SENTINEL, parseRich } from "./richtext";
import { textColors } from "../theme";

// ---------------------------------------------------------------------------
// marcas → HTML

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

// Un span a HTML, anidando de adentro hacia afuera (en HTML el orden no
// tiene la ambigüedad del lado de las marcas).
function spanToHtml(span) {
  let html = escapeHtml(span.text);
  if (span.italic) html = `<em>${html}</em>`;
  if (span.bold) html = `<strong>${html}</strong>`;
  if (span.underline) html = `<u>${html}</u>`;
  if (span.highlight) html = `<mark>${html}</mark>`;
  if (span.color && textColors[span.color]) {
    html = `<span data-color="${span.color}" style="color: ${textColors[span.color]}">${html}</span>`;
  }
  return html;
}

function spansToHtml(spans) {
  return spans.map(spanToHtml).join("");
}

// Consume `n` caracteres del inicio de una lista de spans (para sacar el
// prefijo "N. " de las líneas de lista numerada).
function stripSpanChars(spans, n) {
  const out = [];
  let remaining = n;
  for (const span of spans) {
    if (remaining >= span.text.length) {
      remaining -= span.text.length;
      continue;
    }
    out.push(remaining > 0 ? { ...span, text: span.text.slice(remaining) } : span);
    remaining = 0;
  }
  return out;
}

const OL_RE = /^(\d{1,4})\. /;

// Forma de un bloque de parseRich, con los bloques NUEVOS del formato ya
// interpretados: "---" = divisor, "N. " = ítem de lista numerada. Es la única
// definición de esto en la app — la usan marksToHtml y el render (RichText).
export function describeBlock(block) {
  // Las listas nunca llevan alineación (align null → el render las deja a la
  // izquierda, no heredan el default de la cara).
  if (block.type === "li") return { kind: "li", spans: block.spans, align: null };

  // Sentinel de alineación al inicio de la línea (invisible): alineación
  // EXPLÍCITA. Sin sentinel → align null ("sin tocar", el render aplica el
  // default de la cara).
  let spans = block.spans;
  let align = null;
  const firstChar = spans.length ? spans[0].text[0] : undefined;
  if (firstChar && ALIGN_BY_CHAR[firstChar]) {
    align = ALIGN_BY_CHAR[firstChar];
    spans = stripSpanChars(spans, 1);
  }

  const plain = spans.map((s) => s.text).join("");
  // Imagen: la línea es el sentinel + el data URI (base64 inline).
  if (plain.startsWith(IMG_SENTINEL)) {
    return { kind: "img", src: plain.slice(IMG_SENTINEL.length), spans: [], align };
  }
  if (plain.trim() === "---") return { kind: "hr", spans: [], align };
  const m = OL_RE.exec(plain);
  if (m) {
    // La numeración es un bloque de lista → sin alineación.
    return { kind: "ol", number: Number(m[1]), spans: stripSpanChars(spans, m[0].length), align: null };
  }
  return { kind: "p", spans, align };
}

// style="text-align:..." para un bloque. Se emite para cualquier alineación
// EXPLÍCITA (incluida izquierda); align null → sin style.
function alignStyle(align) {
  return align ? ` style="text-align: ${align}"` : "";
}

export function marksToHtml(marcas) {
  const blocks = parseRich(marcas == null ? "" : marcas).map(describeBlock);
  const out = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    if (block.kind === "hr") {
      out.push("<hr>");
      i++;
      continue;
    }

    if (block.kind === "img") {
      out.push(`<img src="${escapeHtml(block.src)}">`);
      i++;
      continue;
    }

    // Corridas consecutivas de viñetas o numeradas → una sola lista
    // (TipTap anida <p> dentro de cada <li>).
    if (block.kind === "li" || block.kind === "ol") {
      const tag = block.kind === "li" ? "ul" : "ol";
      const start = block.kind === "ol" ? block.number : 1;
      const items = [];
      while (i < blocks.length && blocks[i].kind === block.kind) {
        items.push(blocks[i].spans);
        i++;
      }
      const attr = tag === "ol" && start !== 1 ? ` start="${start}"` : "";
      out.push(
        `<${tag}${attr}>${items.map((sp) => `<li><p>${spansToHtml(sp)}</p></li>`).join("")}</${tag}>`
      );
      continue;
    }

    out.push(`<p${alignStyle(block.align)}>${spansToHtml(block.spans)}</p>`);
    i++;
  }
  return out.join("");
}

// ---------------------------------------------------------------------------
// HTML → marcas

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s) {
  return s.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z]+);/g, (all, code) => {
    if (code[0] === "#") {
      const isHex = code[1] === "x" || code[1] === "X";
      const num = isHex ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : all;
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, code) ? ENTITIES[code] : all;
  });
}

// Clave de color a partir de data-color o de style="color: hex|rgb(...)".
function colorFromAttrs(attrs) {
  const dm = /data-color\s*=\s*["']?([a-zA-Z]+)["']?/.exec(attrs);
  if (dm && textColors[dm[1]]) return dm[1];
  const sm = /color\s*:\s*(#[0-9a-fA-F]{6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))/.exec(attrs);
  if (!sm) return null;
  let hex = sm[1];
  if (hex.startsWith("rgb")) {
    const [r, g, b] = hex.match(/\d+/g).map(Number);
    hex = `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }
  hex = hex.toLowerCase();
  for (const [key, value] of Object.entries(textColors)) {
    if (value.toLowerCase() === hex) return key;
  }
  return null;
}

const MARK_TAGS = { strong: "bold", b: "bold", em: "italic", i: "italic", u: "underline", mark: "highlight" };
const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "tr"]);

// src de un <img> (data URI). Soporta comillas dobles o simples.
function srcFromAttrs(attrs) {
  const m = /src\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attrs);
  if (!m) return "";
  return decodeEntities(m[1] != null ? m[1] : m[2]);
}

// Alineación de un block tag desde style="text-align:..." o data-align.
// Devuelve left/center/right si hay alineación EXPLÍCITA, o null si no hay
// (el editor solo emite el style cuando difiere de su default de cara).
function alignFromAttrs(attrs) {
  const sm = /text-align\s*:\s*(left|center|right)/i.exec(attrs);
  if (sm) return sm[1].toLowerCase();
  const dm = /data-align\s*=\s*["']?(left|center|right)["']?/i.exec(attrs);
  return dm ? dm[1].toLowerCase() : null;
}

export function htmlToMarks(html) {
  const src = (html == null ? "" : String(html))
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "");

  const blocks = []; // { prefix: "" | "- " | "N. " | "hr", spans: [] }
  let cur = null;
  const stack = []; // pila de estilos inline: { tag, style }
  const listStack = []; // { type: 'ul'|'ol', count }
  let liJustOpened = false;

  const curStyle = () => (stack.length ? stack[stack.length - 1].style : {});
  const openBlock = (prefix = "", align = null) => {
    cur = { prefix, spans: [], align };
    blocks.push(cur);
  };
  const closeBlock = () => {
    cur = null;
  };
  const pushText = (text) => {
    const clean = decodeEntities(text.replace(/[\r\n\t]+/g, " "));
    if (!clean) return;
    if (!cur && !clean.trim()) return; // whitespace entre bloques: ignorar
    if (!cur) openBlock();
    cur.spans.push({ text: clean, ...curStyle() });
  };

  const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
  let last = 0;
  let m;
  while ((m = TAG_RE.exec(src))) {
    pushText(src.slice(last, m.index));
    last = TAG_RE.lastIndex;
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const attrs = m[3] || "";
    const wasLiJustOpened = liJustOpened;
    liJustOpened = false;

    if (!closing) {
      if (tag === "br" || tag === "hr") {
        closeBlock();
        if (tag === "hr") {
          blocks.push({ prefix: "hr", spans: [] });
        }
        continue;
      }
      if (tag === "img") {
        closeBlock();
        const src = srcFromAttrs(attrs);
        if (src) blocks.push({ prefix: "img", src, spans: [] });
        continue;
      }
      if (tag === "ul" || tag === "ol") {
        const sm = /start\s*=\s*["']?(\d+)["']?/.exec(attrs);
        listStack.push({ type: tag, count: sm ? Number(sm[1]) - 1 : 0 });
        closeBlock();
        continue;
      }
      if (tag === "li") {
        const list = listStack[listStack.length - 1];
        if (list && list.type === "ol") {
          list.count += 1;
          openBlock(`${list.count}. `);
        } else {
          openBlock("- ");
        }
        liJustOpened = true;
        continue;
      }
      if (BLOCK_TAGS.has(tag)) {
        // <li><p>: el <p> reusa el bloque recién abierto por el <li>.
        if (wasLiJustOpened && cur && cur.spans.length === 0) continue;
        closeBlock();
        openBlock("", alignFromAttrs(attrs));
        continue;
      }
      // Tags inline: los de marca aplican estilo; los desconocidos solo se
      // apilan para que sus cierres no desbalanceen (el texto se conserva).
      const prop = MARK_TAGS[tag];
      let style = curStyle();
      if (prop) style = { ...style, [prop]: true };
      else if (tag === "span") {
        const color = colorFromAttrs(attrs);
        if (color) style = { ...style, color };
      }
      stack.push({ tag, style });
      continue;
    }

    // Cierres.
    if (tag === "ul" || tag === "ol") {
      listStack.pop();
      closeBlock();
      continue;
    }
    if (tag === "li" || tag === "br" || tag === "hr") {
      closeBlock();
      continue;
    }
    if (BLOCK_TAGS.has(tag)) {
      closeBlock();
      continue;
    }
    // Cierre inline tolerante: pop hasta encontrar el tag (si está).
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k].tag === tag) {
        stack.length = k;
        break;
      }
    }
  }
  pushText(src.slice(last));

  return blocksToMarks(blocks);
}

// ---------------------------------------------------------------------------
// spans → marcas (serialización canónica)

function flagsKey(s) {
  return `${!!s.bold}|${!!s.italic}|${!!s.underline}|${!!s.highlight}|${s.color || ""}`;
}

function mergeSpans(spans) {
  const out = [];
  for (const span of spans) {
    if (!span.text) continue;
    const prev = out[out.length - 1];
    if (prev && flagsKey(prev) === flagsKey(span)) prev.text += span.text;
    else out.push({ ...span });
  }
  return out;
}

// Orden canónico (afuera → adentro): [[color: == __ ** *
const RANK = { "==": 1, "__": 2, "**": 3, "*": 4 };
const rankOf = (mark) => (mark.startsWith("color:") ? 0 : RANK[mark]);

// Marcadores presentes en un span, en orden canónico.
// ***a*** NO es expresable en la gramática de richtext.js: si el span tiene
// bold+italic y NINGUNA otra marca que pueda ir entre medio, bold gana y se
// descarta italic (regla determinística → el round-trip es idempotente).
function marksOf(span) {
  const colorKey = span.color && textColors[span.color] ? span.color : null;
  const bold = !!span.bold;
  const underline = !!span.underline;
  const highlight = !!span.highlight;
  const hasSeparator = !!colorKey || highlight || underline;
  const italic = bold && span.italic && !hasSeparator ? false : !!span.italic;

  const out = [];
  if (colorKey) out.push(`color:${colorKey}`);
  if (highlight) out.push("==");
  if (underline) out.push("__");
  if (bold) out.push("**");
  if (italic) out.push("*");
  return out;
}

function wrapMark(mark, inner) {
  return mark.startsWith("color:") ? `[[${mark.slice(6)}:${inner}]]` : `${mark}${inner}${mark}`;
}

// Qué marcadores puede emitir AHORA un span, dado lo ya aplicado por fuera:
//  - "*" solo cuando es lo único que queda (siempre el más interno);
//  - si ** y * conviven, se RESERVA un separador para que quede entre ambos
//    (**__*a*__**) y así ** y * nunca terminan adyacentes.
function choosableMarks(marks, applied) {
  const remaining = marks.filter((m) => !applied.includes(m));
  if (remaining.length === 0) return [];
  const seps = remaining.filter((m) => m !== "**" && m !== "*");
  const reserved =
    remaining.includes("**") && remaining.includes("*") && seps.length === 1 ? seps[0] : null;
  let out = remaining.filter((m) => m !== reserved);
  if (out.length > 1) out = out.filter((m) => m !== "*");
  return out;
}

// Serializa factorizando marcadores comunes de spans ADYACENTES: se elige el
// que abarque el tramo más largo (empate → orden canónico), así
// "==a [[rojo:b]]==" sale con UN solo par de ==. Sin esto cada span repetiría
// su marcador ("==a ==[[rojo:==b==]]"): parseRich lo entiende igual, pero el
// texto guardado queda ilegible.
function serializeSpans(items, applied) {
  let out = "";
  let i = 0;
  while (i < items.length) {
    const choosable = choosableMarks(items[i].marks, applied);
    if (choosable.length === 0) {
      out += items[i].span.text;
      i++;
      continue;
    }
    const runOf = (mark) => {
      let j = i;
      while (j < items.length && choosableMarks(items[j].marks, applied).includes(mark)) j++;
      return j - i;
    };
    let best = choosable[0];
    let bestRun = 0;
    for (const mark of choosable) {
      const run = runOf(mark);
      if (run > bestRun || (run === bestRun && rankOf(mark) < rankOf(best))) {
        best = mark;
        bestRun = run;
      }
    }
    const end = i + runOf(best);
    out += wrapMark(best, serializeSpans(items.slice(i, end), [...applied, best]));
    i = end;
  }
  return out;
}

function blocksToMarks(blocks) {
  const lines = blocks.map((b) => {
    if (b.prefix === "hr") return "---";
    if (b.prefix === "img") return `${IMG_SENTINEL}${b.src}`;
    const items = mergeSpans(b.spans).map((span) => ({ span, marks: marksOf(span) }));
    // Sentinel de alineación EXPLÍCITA solo en párrafos (las listas van sin
    // alineación). b.align null = "sin tocar" → sin sentinel.
    const sentinel = !b.prefix && b.align ? ALIGN_SENTINELS[b.align] || "" : "";
    return `${sentinel}${b.prefix || ""}${serializeSpans(items, [])}`;
  });
  while (lines.length && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.join("\n");
}
