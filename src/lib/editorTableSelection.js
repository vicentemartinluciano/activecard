import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { NodeSelection } from "@tiptap/pm/state";

export function tableContext(editor) {
  const selection = editor.state.selection;
  if (selection instanceof NodeSelection && selection.node.type.spec.tableRole === "table")
    return { node: selection.node, pos: selection.from };
  const anchor = selection instanceof CellSelection ? selection.$anchorCell : selection.$from;
  for (let depth = anchor.depth; depth > 0; depth--)
    if (anchor.node(depth).type.spec.tableRole === "table")
      return { node: anchor.node(depth), pos: anchor.before(depth) };
  return null;
}

export function isTableMarked(editor) {
  const selection = editor.state.selection;
  return (
    selection instanceof CellSelection ||
    (selection instanceof NodeSelection && selection.node.type.spec.tableRole === "table")
  );
}

function edges(node) {
  const map = TableMap.get(node);
  return {
    row: new Set(map.map.slice(0, map.width)),
    column: new Set(Array.from({ length: map.height }, (_, index) => map.map[index * map.width])),
  };
}

export function tableHeaderState(editor) {
  const table = tableContext(editor);
  if (!table) return { row: false, column: false };
  const first = edges(table.node);
  const header = (positions) =>
    [...positions].every((pos) => table.node.nodeAt(pos).type.spec.tableRole === "header_cell");
  return { row: header(first.row), column: header(first.column) };
}

// Encabezados de la primera fila/columna, como en una tabla simple de Notion.
// Quitar uno conserva la intersección cuando el otro sigue activo.
export function toggleTableHeader(editor, kind) {
  const table = tableContext(editor);
  if (!table || !["row", "column"].includes(kind)) return false;
  const first = edges(table.node);
  const active = tableHeaderState(editor);
  const other = kind === "row" ? "column" : "row";
  const headerType = Object.values(editor.schema.nodes).find((type) => type.spec.tableRole === "header_cell");
  const cellType = Object.values(editor.schema.nodes).find((type) => type.spec.tableRole === "cell");
  const tr = editor.state.tr;
  for (const pos of first[kind]) {
    const cell = table.node.nodeAt(pos);
    const header = !active[kind] || (active[other] && first[other].has(pos));
    tr.setNodeMarkup(table.pos + 1 + pos, header ? headerType : cellType, cell.attrs, cell.marks);
  }
  editor.view.dispatch(tr);
  return true;
}
