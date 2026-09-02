// Formato liviano tipo Notion, guardado como marcas dentro del mismo TEXT
// de front/back — sin migración de esquema, 100% compatible con tarjetas
// viejas (que simplemente no tienen marcas).
//
// Gramática (una línea = un bloque; "- " al inicio = ítem de lista):
//   **negrita**   *cursiva*   __subrayado__   ==resaltado==
//   [[color:texto]]   (color: clave de theme.textColors, ej. [[rojo:urgente]])
//
// parseRich(text) -> [{ type: 'p'|'li', spans: [{text, bold, italic,
//   underline, highlight, color}] }]

const MARKERS = [
  { open: "**", close: "**", prop: "bold" },
  { open: "__", close: "__", prop: "underline" },
  { open: "==", close: "==", prop: "highlight" },
  { open: "~~", close: "~~", prop: "strike" },
  { open: "*", close: "*", prop: "italic" },
];

// Alineación por bloque: un sentinel invisible (Unicode de uso privado, que el
// usuario no puede tipear) al inicio de la línea marca la alineación EXPLÍCITA
// (izquierda/centro/derecha). SIN sentinel = "sin tocar" → default por cara. parseRich lo ve como texto plano; lo
// quitan describeBlock (richhtml.js) al renderizar/convertir y toPlainText acá.
// Nunca se muestra crudo, así que no colisiona con contenido real.
export const ALIGN_SENTINELS = { left: "\uE002", center: "\uE000", right: "\uE001" };
export const ALIGN_BY_CHAR = { "\uE002": "left", "\uE000": "center", "\uE001": "right" };
const ALIGN_STRIP_RE = /^[\uE000\uE001\uE002]/;

// Bloque imagen: una l\u00EDnea entera que empieza con este sentinel invisible, con
// el data URI (base64 comprimido) a continuaci\u00F3n. Va inline en el TEXT de la
// tarjeta (entra al respaldo). parseRich lo ve como texto plano; describeBlock
// (richhtml.js) lo interpreta y RichText lo renderiza como <Image>. toPlainText
// lo omite (as\u00ED no ensucia previews / b\u00FAsqueda / contexto de IA).
export const IMG_SENTINEL = "\uE010";

// Formato por bloque (títulos y cita). Al igual que la alineación, vive como
// un sentinel privado e invisible al inicio de la línea para conservar el
// WYSIWYG sin cambiar el esquema SQLite ni mostrar Markdown al usuario.
export const BLOCK_SENTINELS = {
  heading1: "\uE020",
  heading2: "\uE021",
  heading3: "\uE022",
  quote: "\uE023",
};
export const BLOCK_BY_CHAR = Object.fromEntries(
  Object.entries(BLOCK_SENTINELS).map(([key, value]) => [value, key])
);
const BLOCK_STRIP_RE = /^[\uE020-\uE023]/;
const LEGACY_EMPTY_QUOTE_RE = /^([\uE000\uE001\uE002]?)\uE023$/;

const COLOR_RE = /^\[\[([a-zA-Z]+):/;

// Parsea una línea a una lista de spans, aplicando los estilos heredados
// del contexto (para que las marcas puedan anidarse: **a ==b==**).
function parseLine(line, inherited) {
  const spans = [];
  let i = 0;

  const flushText = (text) => {
    if (text) spans.push({ text, ...inherited });
  };

  let buffer = "";
  while (i < line.length) {
    // Color: [[clave:contenido]]
    if (line[i] === "[" && line[i + 1] === "[") {
      const m = COLOR_RE.exec(line.slice(i));
      if (m) {
        const closeIdx = line.indexOf("]]", i);
        if (closeIdx !== -1) {
          flushText(buffer);
          buffer = "";
          const inner = line.slice(i + m[0].length, closeIdx);
          spans.push(...parseLine(inner, { ...inherited, color: m[1] }));
          i = closeIdx + 2;
          continue;
        }
      }
    }

    // Marcas de estilo (probar las de 2 chars antes que las de 1, para que
    // ** no se interprete como dos *).
    let matched = false;
    for (const marker of MARKERS) {
      if (line.startsWith(marker.open, i) && !inherited[marker.prop]) {
        const closeIdx = line.indexOf(marker.close, i + marker.open.length);
        if (closeIdx !== -1) {
          flushText(buffer);
          buffer = "";
          const inner = line.slice(i + marker.open.length, closeIdx);
          spans.push(...parseLine(inner, { ...inherited, [marker.prop]: true }));
          i = closeIdx + marker.close.length;
        } else {
          // Sin cierre: los caracteres se toman como texto literal, de un
          // saque, para que un marcador más corto que comparte carácter
          // (el * suelto dentro de un ** sin cerrar) no lo reinterprete.
          buffer += marker.open;
          i += marker.open.length;
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    buffer += line[i];
    i++;
  }
  flushText(buffer);
  return spans;
}

export function parseRich(text) {
  const raw = text == null ? "" : String(text);
  const lines = raw.split("\n");

  // Compatibilidad con citas guardadas por el conversor anterior. TipTap
  // entrega <blockquote><p>texto</p></blockquote> y antes se persistía como
  // una cita vacía seguida por un párrafo normal. Al leer ese patrón exacto,
  // reunimos la barra y el texto; la próxima edición ya lo guarda canónico.
  for (let i = 0; i < lines.length - 1; i++) {
    const legacy = LEGACY_EMPTY_QUOTE_RE.exec(lines[i]);
    if (!legacy || !lines[i + 1]) continue;

    const nextAlign = ALIGN_BY_CHAR[lines[i + 1][0]] ? lines[i + 1][0] : "";
    const nextContent = nextAlign ? lines[i + 1].slice(1) : lines[i + 1];
    if (BLOCK_BY_CHAR[nextContent[0]] || nextContent.startsWith(IMG_SENTINEL)) continue;

    lines[i + 1] = `${nextAlign || legacy[1]}${BLOCK_SENTINELS.quote}${nextContent}`;
    lines.splice(i, 1);
    i--;
  }
  return lines.map((line) => {
    const isListItem = line.startsWith("- ");
    const content = isListItem ? line.slice(2) : line;
    return {
      type: isListItem ? "li" : "p",
      spans: parseLine(content, {}),
    };
  });
}

// Texto sin ninguna marca — para previews de una línea, para el contexto
// que se le manda a la IA, y para comparar contenido "de verdad".
export function toPlainText(text) {
  return parseRich(text)
    .map((block) => {
      const plain = block.spans.map((s) => s.text).join("")
        .replace(ALIGN_STRIP_RE, "")
        .replace(BLOCK_STRIP_RE, "");
      // Los bloques imagen no aportan texto (evita volcar el data URI base64 en
      // previews / búsqueda / contexto de IA).
      return plain.startsWith(IMG_SENTINEL) ? "" : plain;
    })
    .join("\n");
}

// Envuelve (o desenvuelve, si ya está envuelto exacto) el rango [start, end)
// de `text` con el marcador dado ("**", "*", "__", "=="). Devuelve
// { text, start, end } con la selección reubicada sobre el resultado.
export function wrapSelection(text, start, end, marker) {
  if (start === end) return { text, start, end };
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);

  const alreadyWrapped =
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length >= marker.length * 2;

  if (alreadyWrapped) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return {
      text: before + inner + after,
      start,
      end: start + inner.length,
    };
  }

  const wrapped = marker + selected + marker;
  return {
    text: before + wrapped + after,
    start,
    end: start + wrapped.length,
  };
}

// Envuelve el rango en un color: [[clave:...]]. Sin toggle (los colores no
// se anidan entre sí en la UI — elegir otro color reemplaza, no se pide acá).
export function wrapColor(text, start, end, colorKey) {
  if (start === end) return { text, start, end };
  const before = text.slice(0, start);
  const selected = text.slice(start, end);
  const after = text.slice(end);
  const wrapped = `[[${colorKey}:${selected}]]`;
  return { text: before + wrapped + after, start, end: start + wrapped.length };
}

// Agrega o quita "- " al inicio de cada línea tocada por [start, end).
export function toggleListLines(text, start, end) {
  const lines = text.split("\n");
  // Ubicar qué líneas caen dentro del rango de selección.
  let pos = 0;
  const touched = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const lineStart = pos;
    const lineEnd = pos + lines[idx].length;
    if (lineEnd >= start && lineStart <= end) touched.push(idx);
    pos = lineEnd + 1; // +1 por el \n
  }
  const allAreLists = touched.every((idx) => lines[idx].startsWith("- "));
  for (const idx of touched) {
    lines[idx] = allAreLists ? lines[idx].slice(2) : `- ${lines[idx]}`;
  }
  return lines.join("\n");
}
