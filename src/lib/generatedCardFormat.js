import { BLOCK_SENTINELS, encodeTable, encodeToggle, hasRichContent } from './richtext';
import { encodeFormatted, encodeList } from './richContent';

// La IA describe bloques legibles; la app produce las marcas reales del editor.
// No se pide al modelo que improvise sentinels ni JSON codificado en URI.
export function compileGeneratedBack(value, depth = 0) {
  if (typeof value === 'string') return value.trim(); // Propuestas anteriores.
  const fail = () => { throw new Error('La IA devolvió un formato incompleto. Volvé a generar las propuestas.'); };
  if (!Array.isArray(value) || !value.length || value.length > 200 || depth > 6) return fail();
  const text = (content) => typeof content === 'string' && content.trim() ? content.trim() : fail();
  const styled = (block, kind) => {
    const spans = block.spans;
    const flags = ['bold', 'italic', 'underline', 'strike', 'highlight'];
    const colors = ['rojo', 'naranja', 'amarillo', 'verde', 'azul', 'violeta'];
    if (!Array.isArray(spans) || !spans.length || spans.some((span) => typeof span?.text !== 'string' || flags.some((key) => span[key] != null && typeof span[key] !== 'boolean') || span.color != null && !colors.includes(span.color)) || ![null, undefined, 'left', 'center', 'right'].includes(block.align)) return fail();
    return encodeFormatted({ kind, align: block.align ?? null, spans });
  };
  return value.map((block) => {
    if (!block || typeof block !== 'object') return fail();
    switch (block.type) {
      case 'paragraph': return block.spans ? styled(block, 'p') : text(block.text);
      case 'heading': {
        if (![1, 2, 3].includes(block.level)) return fail();
        return block.spans ? styled(block, `heading${block.level}`) : BLOCK_SENTINELS[`heading${block.level}`] + text(block.text);
      }
      case 'quote': return block.spans ? styled(block, 'quote') : text(block.text).split('\n').map((line) => BLOCK_SENTINELS.quote + line).join('\n');
      case 'separator': return '---';
      case 'toggle': return encodeToggle(text(block.title), compileGeneratedBack(block.blocks, depth + 1));
      case 'bullets':
      case 'numbered': {
        if (!Array.isArray(block.items) || !block.items.length || block.items.length > 100) return fail();
        const start = block.start ?? 1;
        if (!Number.isSafeInteger(start) || start < 1) return fail();
        return encodeList({ ordered: block.type === 'numbered', start, items: block.items.map((item) => typeof item === 'string' ? text(item) : compileGeneratedBack(item, depth + 1)) });
      }
      case 'table': {
        const rows = block.rows;
        if (!Array.isArray(rows) || !rows.length || rows.length > 30 || !Array.isArray(rows[0]) || !rows[0].length || rows[0].length > 6 || rows.some((row) => !Array.isArray(row) || row.length !== rows[0].length)) return fail();
        return encodeTable(rows.map((row, index) => row.map((cell) => ({ text: text(cell), header: index === 0 }))));
      }
      default: return fail();
    }
  }).join('\n');
}

export function normalizeGeneratedCard(card) {
  if (!card || typeof card.front !== 'string' || !card.front.trim()) throw new Error('La IA devolvió una tarjeta sin pregunta. Volvé a generar las propuestas.');
  const back = compileGeneratedBack(card.back);
  if (!hasRichContent(back)) throw new Error('La IA devolvió una tarjeta sin respuesta. Volvé a generar las propuestas.');
  return { front: card.front.trim(), back };
}
