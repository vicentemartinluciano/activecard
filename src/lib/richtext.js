// Formato liviano tipo Notion, guardado como marcas dentro del mismo TEXT
// de front/back — sin migración de esquema, 100% compatible con tarjetas
// viejas (que simplemente no tienen marcas).
//
// Gramática (una línea = un bloque; "- " al inicio = ítem de lista):
//   **negrita**   *cursiva*   __subrayado__   ==resaltado==
//   [[color:texto]]   (color: clave de theme.textColors, ej. [[rojo:urgente]])
//
// El motor es un parser recursivo indexado: además de los spans públicos,
// registra el rango exacto de cada tramo de texto y de cada par de marcas
// dentro del string fuente. Sobre eso se construyen:
//   - parseRich(text) -> [{ type: 'p'|'li', spans: [{text, bold, italic,
//     underline, highlight, color}] }]  (API pública, sin offsets)
//   - buildEditMap(text) -> mapa display<->source para el editor WYSIWYG
//     (el display es el texto SIN marcadores; el "- " de lista y los \n
//     son texto visible y se conservan).

const MARKERS = [
  { open: "**", close: "**", prop: "bold" },
  { open: "__", close: "__", prop: "underline" },
  { open: "==", close: "==", prop: "highlight" },
  { open: "*", close: "*", prop: "italic" },
];

const COLOR_RE = /^\[\[([a-zA-Z]+):/;

// ---------------------------------------------------------------------------
// Núcleo indexado
// ---------------------------------------------------------------------------

// Parsea la región [from, to) de `text` (una línea o el inner de una marca),
// con la misma semántica de siempre: cierre más cercano dentro de la región,
// marca cuya prop ya está heredada se toma literal, marca sin cierre se toma
// literal de un saque. Acumula en `out`:
//   segments: [{ kind:'text', sStart, sEnd, text, styles }]
//   runs:     [{ kind:'mark'|'color', prop?, marker?, colorKey?,
//                openStart, innerStart, innerEnd, closeEnd }]
function parseRegion(text, from, to, inherited, out) {
  let i = from;
  let buffer = "";
  let bufStart = from;

  const append = (str, at) => {
    if (!buffer) bufStart = at;
    buffer += str;
  };
  const flush = () => {
    if (buffer) {
      out.segments.push({
        kind: "text",
        sStart: bufStart,
        sEnd: bufStart + buffer.length,
        text: buffer,
        styles: inherited,
      });
    }
    buffer = "";
  };

  while (i < to) {
    // Color: [[clave:contenido]]
    if (text[i] === "[" && text[i + 1] === "[") {
      const m = COLOR_RE.exec(text.slice(i, to));
      if (m) {
        const closeIdx = text.indexOf("]]", i);
        if (closeIdx !== -1 && closeIdx + 2 <= to) {
          flush();
          out.runs.push({
            kind: "color",
            colorKey: m[1],
            openStart: i,
            innerStart: i + m[0].length,
            innerEnd: closeIdx,
            closeEnd: closeIdx + 2,
          });
          parseRegion(text, i + m[0].length, closeIdx, { ...inherited, color: m[1] }, out);
          i = closeIdx + 2;
          continue;
        }
      }
    }

    // Marcas de estilo (probar las de 2 chars antes que las de 1, para que
    // ** no se interprete como dos *).
    let matched = false;
    for (const marker of MARKERS) {
      if (text.startsWith(marker.open, i) && !inherited[marker.prop]) {
        const closeIdx = text.indexOf(marker.close, i + marker.open.length);
        if (closeIdx !== -1 && closeIdx + marker.close.length <= to) {
          flush();
          out.runs.push({
            kind: "mark",
            prop: marker.prop,
            marker: marker.open,
            openStart: i,
            innerStart: i + marker.open.length,
            innerEnd: closeIdx,
            closeEnd: closeIdx + marker.close.length,
          });
          parseRegion(text, i + marker.open.length, closeIdx, { ...inherited, [marker.prop]: true }, out);
          i = closeIdx + marker.close.length;
        } else {
          // Sin cierre: los caracteres se toman como texto literal, de un
          // saque, para que un marcador más corto que comparte carácter
          // (el * suelto dentro de un ** sin cerrar) no lo reinterprete.
          append(marker.open, i);
          i += marker.open.length;
        }
        matched = true;
        break;
      }
    }
    if (matched) continue;

    append(text[i], i);
    i++;
  }
  flush();
}

// Parsea el texto completo a la representación indexada. Los "- " de lista
// y los "\n" entre líneas entran como segments propios (son texto visible
// en el editor), con kind distinto para que parseRich pueda excluirlos.
function parseIndexed(text) {
  const raw = text == null ? "" : String(text);
  const out = { source: raw, segments: [], runs: [], lines: [] };
  const lines = raw.split("\n");
  let offset = 0;
  for (const line of lines) {
    const lineStart = offset;
    if (lineStart > 0) {
      out.segments.push({
        kind: "newline",
        sStart: lineStart - 1,
        sEnd: lineStart,
        text: "\n",
        styles: {},
      });
    }
    const isList = line.startsWith("- ");
    if (isList) {
      out.segments.push({
        kind: "listMarker",
        sStart: lineStart,
        sEnd: lineStart + 2,
        text: "- ",
        styles: {},
      });
    }
    const contentStart = lineStart + (isList ? 2 : 0);
    parseRegion(raw, contentStart, lineStart + line.length, {}, out);
    out.lines.push({
      start: lineStart,
      contentStart,
      end: lineStart + line.length,
      isList,
    });
    offset += line.length + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// API pública de lectura
// ---------------------------------------------------------------------------

export function parseRich(text) {
  const idx = parseIndexed(text);
  return idx.lines.map((line) => ({
    type: line.isList ? "li" : "p",
    spans: idx.segments
      .filter(
        (s) => s.kind === "text" && s.sStart >= line.contentStart && s.sEnd <= line.end
      )
      .map((s) => ({ text: s.text, ...s.styles })),
  }));
}

// Texto sin ninguna marca — para previews de una línea, para el contexto
// que se le manda a la IA, y para comparar contenido "de verdad".
export function toPlainText(text) {
  return parseRich(text)
    .map((block) => block.spans.map((s) => s.text).join(""))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Mapa display <-> source para el editor
// ---------------------------------------------------------------------------

// El "display" es lo que ve/edita el usuario: el texto fuente SIN los
// marcadores inline. Conserva los "- " de lista y los "\n" (son tipeables).
// Cada segment es contiguo en ambos espacios: dEnd-dStart === sEnd-sStart.
export function buildEditMap(text) {
  const idx = parseIndexed(text);
  let display = "";
  const segments = idx.segments.map((s) => {
    const dStart = display.length;
    display += s.text;
    return {
      dStart,
      dEnd: display.length,
      sStart: s.sStart,
      sEnd: s.sEnd,
      styles: s.styles,
    };
  });
  return { display, segments };
}

// Traduce un índice del display al source. En una frontera entre segments
// (donde en el source puede haber marcadores invisibles de por medio), el
// bias decide de qué lado caer: 'left' se pega al final del segment anterior
// (queda DENTRO de la marca que termina ahí), 'right' al inicio del segment
// siguiente. Con right en el start y left en el end, una selección de display
// se mapea al inner de la marca que la envuelve.
export function displayToSource(map, dIdx, bias) {
  const segs = map.segments;
  if (!segs.length) return 0;
  for (let k = 0; k < segs.length; k++) {
    const seg = segs[k];
    if (dIdx > seg.dStart && dIdx < seg.dEnd) {
      return seg.sStart + (dIdx - seg.dStart);
    }
    if (dIdx === seg.dStart && bias === "right") return seg.sStart;
    if (dIdx === seg.dEnd && bias === "left") return seg.sEnd;
  }
  // Fronteras no resueltas por el bias: caer al borde más cercano.
  if (dIdx <= 0) return segs[0].sStart;
  return segs[segs.length - 1].sEnd;
}

// Traduce un índice del source al display. Si cae dentro de un tramo de
// marcadores (invisible), se ajusta al borde visible más cercano.
export function sourceToDisplay(map, sIdx) {
  for (const seg of map.segments) {
    if (sIdx <= seg.sStart) return seg.dStart;
    if (sIdx <= seg.sEnd) return seg.dStart + (sIdx - seg.sStart);
  }
  return map.display.length;
}

// ---------------------------------------------------------------------------
// Helpers de edición por selección (legado, siguen en uso por tests/compat)
// ---------------------------------------------------------------------------

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
