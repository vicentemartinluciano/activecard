import { TABLE_ACTIONS } from "./editorSetup";
import { positionEditorPanel, visibleEditorBounds } from "./editorGeometry";
import { isTableMarked, tableContext, tableHeaderState, toggleTableHeader } from "./editorTableSelection";

const SIX_DOTS =
  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>';

// Fuera del scroll de la tabla: las acciones siguen visibles incluso en una
// columna desplazada y conservan la selección de la celda al tocar un botón.
export function attachEditorTableControls(editor, host) {
  const panel = document.createElement("div");
  panel.className = "nf-table-panel";
  panel.setAttribute("role", "toolbar");
  panel.setAttribute("aria-label", "Editar tabla");
  panel.hidden = true;
  const row = document.createElement("div");
  row.className = "nf-table-primary";
  const menu = document.createElement("div");
  menu.className = "nf-table-options";
  menu.hidden = true;
  let frame = null;
  let hoveredTable = null;
  let menuTop = null;
  const grip = document.createElement("button");
  grip.type = "button";
  grip.className = "nf-table-grip";
  grip.setAttribute("aria-label", "Seleccionar tabla y abrir opciones");
  grip.innerHTML = SIX_DOTS;
  grip.hidden = true;
  grip.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  grip.addEventListener("click", () => {
    const table = hoveredTable || tableContext(editor);
    if (!table) return;
    editor.commands.setNodeSelection(table.pos);
    editor.view.focus();
    menu.hidden = false;
    more.setAttribute("aria-expanded", "true");
    positionNow();
  });
  const close = () => {
    menu.hidden = true;
    menuTop = null;
    more.setAttribute("aria-expanded", "false");
    schedule();
  };
  for (const action of TABLE_ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nf-btn";
    button.textContent = action.text;
    button.title = action.label;
    button.setAttribute("aria-label", action.label);
    button.dataset.command = action.key;
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      editor.chain().focus()[action.key]().run();
      close();
    });
    (action.key.startsWith("add") ? row : menu).append(button);
  }
  const more = document.createElement("button");
  more.type = "button";
  more.className = "nf-btn";
  more.innerHTML = SIX_DOTS;
  more.title = "Más opciones de tabla";
  more.setAttribute("aria-label", "Más opciones de tabla");
  more.setAttribute("aria-expanded", "false");
  more.addEventListener("pointerdown", (event) => event.preventDefault());
  more.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    menuTop = null;
    more.setAttribute("aria-expanded", String(!menu.hidden));
    positionNow();
  });
  row.append(more);
  const headers = {};
  for (const [kind, label] of [
    ["column", "Columna de encabezado"],
    ["row", "Fila de encabezado"],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nf-btn";
    button.textContent = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      toggleTableHeader(editor, kind);
      positionNow();
    });
    headers[kind] = button;
    menu.prepend(button);
  }
  panel.append(row, menu);
  const ownGrip = !host.classList.contains("nf-notes");
  if (ownGrip) host.append(grip);
  host.append(panel);
  const position = () => {
    frame = null;
    if (editor.isDestroyed || !host.isConnected) return;
    const context = tableContext(editor);
    const gripTable = hoveredTable || (editor.isFocused ? context : null);
    grip.hidden = !editor.isEditable || !gripTable;
    if (gripTable) {
      const dom = editor.view.nodeDOM(gripTable.pos);
      const box = dom?.getBoundingClientRect();
      const root = host.getBoundingClientRect();
      if (box) grip.style.top = `${Math.max(0, box.top - root.top + 8)}px`;
    }
    panel.hidden = !(
      editor.isEditable &&
      editor.isFocused &&
      isTableMarked(editor) &&
      !host.classList.contains("nf-command") &&
      !host.classList.contains("nf-dragging")
    );
    if (panel.hidden) {
      menu.hidden = true;
      menuTop = null;
      more.setAttribute("aria-expanded", "false");
      host.dispatchEvent(new Event("nf:layout"));
      return;
    }
    for (const button of panel.querySelectorAll("[data-command]"))
      button.disabled = !editor.can()[button.dataset.command]();
    const state = tableHeaderState(editor);
    for (const kind of ["row", "column"]) {
      headers[kind].setAttribute("aria-pressed", String(state[kind]));
      headers[kind].classList.toggle("is-active", state[kind]);
    }
    const root = host.getBoundingClientRect();
    const width = Math.max(0, Math.min(258, root.width - 8));
    panel.style.width = `${width}px`;
    const node = context && editor.view.nodeDOM(context.pos);
    const cell = node?.querySelector("tr");
    const cursor = cell?.getBoundingClientRect() || editor.view.coordsAtPos(editor.state.selection.head);
    panel.style.left = `${Math.max(4, Math.min(cursor.left - root.left, root.width - width - 4))}px`;
    if (!menu.hidden && menuTop != null) {
      // El scroll que dispara el navegador para enfocar una celda no debe
      // cambiar de lado un menú ya abierto debajo del puntero.
      const bounds = visibleEditorBounds(host);
      const available = Math.max(44, bounds.bottom - bounds.top - 8);
      panel.style.maxHeight = `${available}px`;
      const height = Math.min(panel.getBoundingClientRect().height, available);
      panel.style.top = `${Math.max(bounds.top + 4, Math.min(menuTop - root.top, bounds.bottom - 4 - height))}px`;
      host.dispatchEvent(new Event("nf:layout"));
    } else {
      positionEditorPanel(host, panel, cursor, true);
      if (!menu.hidden) menuTop = panel.getBoundingClientRect().top;
    }
  };
  const schedule = () => {
    if (frame != null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(position);
  };
  // Medir el menú abierto antes de mostrarlo: evita que cambie de lado entre
  // pointerdown y click y que un toque rápido termine en otra acción.
  const positionNow = () => {
    if (frame != null) cancelAnimationFrame(frame);
    position();
  };
  const transaction = ({ transaction: tr }) => {
    if (tr.docChanged) hoveredTable = null;
    schedule();
  };
  const outside = (event) => {
    if (!panel.contains(event.target)) close();
  };
  const hover = (event) => {
    if (grip.contains(event.target) || panel.contains(event.target)) return;
    const table = event.target.closest?.(".tableWrapper, table");
    hoveredTable = null;
    if (table)
      editor.state.doc.forEach((node, pos) => {
        if (node.type.spec.tableRole !== "table") return;
        const dom = editor.view.nodeDOM(pos);
        if (dom === table || dom?.contains(table)) hoveredTable = { node, pos };
      });
    schedule();
  };
  const leave = () => {
    hoveredTable = null;
    schedule();
  };
  const escape = (event) => {
    if (event.key === "Escape" && !menu.hidden) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  };
  const dismiss = () => {
    panel.hidden = true;
    close();
  };
  const selectTable = () => {
    menu.hidden = false;
    menuTop = null;
    more.setAttribute("aria-expanded", "true");
    positionNow();
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(editor.view.dom);
  editor.on("transaction", transaction);
  editor.on("focus", schedule);
  editor.on("blur", close);
  document.addEventListener("pointerdown", outside);
  host.addEventListener("pointerover", hover);
  host.addEventListener("pointerleave", leave);
  host.addEventListener("keydown", escape);
  host.addEventListener("nf:viewport", schedule);
  host.addEventListener("nf:dismiss-controls", dismiss);
  host.addEventListener("nf:select-table", selectTable);
  window.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  schedule();
  return () => {
    if (frame != null) cancelAnimationFrame(frame);
    observer.disconnect();
    editor.off("transaction", transaction);
    editor.off("focus", schedule);
    editor.off("blur", close);
    document.removeEventListener("pointerdown", outside);
    host.removeEventListener("pointerover", hover);
    host.removeEventListener("pointerleave", leave);
    host.removeEventListener("keydown", escape);
    host.removeEventListener("nf:viewport", schedule);
    host.removeEventListener("nf:dismiss-controls", dismiss);
    host.removeEventListener("nf:select-table", selectTable);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("scroll", schedule);
    panel.remove();
    grip.remove();
  };
}
