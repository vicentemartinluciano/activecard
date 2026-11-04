// Extensiones del formato de texto: se usan solo donde las marcas anteriores
// no pueden representar el contenido sin pérdidas. Los lectores nuevos siguen
// leyendo todas las tarjetas anteriores; un cliente viejo debe actualizarse.
export const LIST_SENTINEL = "\uE032";
export const FORMATTED_SENTINEL = "\uE033";

const encode = (sentinel, value) => sentinel + encodeURIComponent(JSON.stringify(value));
function decode(line, sentinel) {
  if (!line.startsWith(sentinel)) return null;
  try { return JSON.parse(decodeURIComponent(line.slice(1))); } catch { return null; }
}
export const encodeList = (value) => encode(LIST_SENTINEL, value);
export function decodeList(line) {
  const value = decode(line, LIST_SENTINEL);
  if (!value || typeof value.ordered !== "boolean" || !Number.isSafeInteger(value.start) || value.start < 1 ||
      !Array.isArray(value.items) || !value.items.length || value.items.some(item => typeof item !== "string")) return null;
  return { ordered: value.ordered, start: value.start, items: value.items };
}
export const encodeFormatted = (value) => encode(FORMATTED_SENTINEL, normalizeFormatted(value));
function normalizeFormatted(value) {
  if (!value || !["p", "heading1", "heading2", "heading3", "quote", "li", "ol"].includes(value.kind) ||
      ![null, "left", "center", "right"].includes(value.align) || !Array.isArray(value.spans) ||
      value.spans.some(span => typeof span?.text !== "string")) return null;
  if (value.kind === "ol" && (!Number.isSafeInteger(value.number) || value.number < 1)) return null;
  return { kind: value.kind, align: value.align, ...(value.kind === "ol" ? { number: value.number } : {}),
    ...(value.quoteStart ? { quoteStart: true } : {}), spans: value.spans.map(span => ({ text: span.text,
      ...Object.fromEntries(["bold", "italic", "underline", "strike", "highlight"].filter(flag => span[flag] === true).map(flag => [flag, true])),
      ...(["rojo", "naranja", "amarillo", "verde", "azul", "violeta"].includes(span.color) ? { color: span.color } : {}),
    })) };
}
export const decodeFormatted = line => normalizeFormatted(decode(line, FORMATTED_SENTINEL));
