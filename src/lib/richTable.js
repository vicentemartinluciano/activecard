// Geometría y anchos adaptados de las tablas de REANCLA.
export function validColumnWidths(widths, colspan) {
  return (
    Array.isArray(widths) &&
    widths.length === colspan &&
    widths.every((width) => Number.isSafeInteger(width) && width >= 0 && width <= 10000) &&
    widths.some((width) => width > 0)
  );
}

export function tableColumnWidths(rows, defaultWidth = 160, minWidth = 80) {
  const { cells, columns } = tableGrid(rows);
  const widths = Array(columns).fill(defaultWidth);
  const found = new Set();
  for (const cell of cells) {
    if (!validColumnWidths(cell.colwidth, cell.colspan)) continue;
    cell.colwidth.forEach((width, index) => {
      const column = cell.column + index;
      if (width > 0 && !found.has(column)) {
        widths[column] = Math.max(minWidth, width);
        found.add(column);
      }
    });
  }
  return widths;
}

// Posiciones compartidas para lectura y exportación, incluidas celdas combinadas.
export function tableGrid(rows) {
  const occupied = [];
  const cells = [];
  let columns = 0;
  rows.forEach((row, r) => {
    let c = 0;
    row.forEach((cell) => {
      while (occupied[r]?.[c]) c++;
      const rowspan = Math.min(cell.rowspan, rows.length - r);
      cells.push({ ...cell, row: r, column: c, rowspan });
      for (let y = r; y < r + rowspan; y++) {
        occupied[y] ||= [];
        for (let x = c; x < c + cell.colspan; x++) occupied[y][x] = true;
      }
      c += cell.colspan;
      columns = Math.max(columns, c);
    });
  });
  return { cells, columns };
}
