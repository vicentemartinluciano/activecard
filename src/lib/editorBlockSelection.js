import { closeHistory } from "@tiptap/pm/history";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { blockAtY, positionEditorPanel, visibleEditorBounds } from "./editorGeometry";
import { focusEditorBottom } from "./editorSetup";

const multiSelectKey = new PluginKey("activecardMultiBlockSelect");

function normalizeBlockIndices(doc, indices) {
  if (!doc || !Array.isArray(indices)) return [];
  return Array.from(new Set(indices))
    .filter((i) => Number.isInteger(i) && i >= 0 && i < doc.childCount)
    .sort((a, b) => a - b);
}

function blockStartOffset(doc, index) {
  let pos = 0;
  for (let i = 0; i < index; i += 1) pos += doc.child(i).nodeSize;
  return pos;
}

export function deleteBlocks(editor, indices) {
  if (!editor || editor.isDestroyed) return false;
  const doc = editor.state.doc;
  const sorted = normalizeBlockIndices(doc, indices);
  if (!sorted.length) return false;
  const paragraph = editor.state.schema.nodes.paragraph?.create?.();

  return editor
    .chain()
    .command(({ tr }) => {
      closeHistory(tr);
      if (sorted.length >= doc.childCount && paragraph) {
        tr.replaceWith(0, tr.doc.content.size, paragraph);
        tr.setSelection(TextSelection.create(tr.doc, 1));
      } else {
        const firstStart = blockStartOffset(tr.doc, sorted[0]);
        for (let k = sorted.length - 1; k >= 0; k -= 1) {
          const idx = sorted[k];
          const from = blockStartOffset(tr.doc, idx);
          const child = tr.doc.child(idx);
          tr.delete(from, from + child.nodeSize);
        }
        const safePos = Math.max(0, Math.min(firstStart + 1, tr.doc.content.size));
        tr.setSelection(TextSelection.near(tr.doc.resolve(safePos)));
      }
      closeHistory(tr);
      return true;
    })
    .run();
}

export function duplicateBlocks(editor, indices) {
  if (!editor || editor.isDestroyed) return [];
  const doc = editor.state.doc;
  const sorted = normalizeBlockIndices(doc, indices);
  if (!sorted.length) return [];

  const nodes = sorted.map((idx) => doc.child(idx));
  const afterIndex = sorted[sorted.length - 1];
  const insertAt = blockStartOffset(doc, afterIndex) + doc.child(afterIndex).nodeSize;

  const ok = editor
    .chain()
    .command(({ tr }) => {
      closeHistory(tr);
      tr.insert(insertAt, nodes);
      closeHistory(tr);
      return true;
    })
    .run();

  if (!ok) return [];
  return sorted.map((_, offset) => afterIndex + 1 + offset);
}

export function moveBlocks(editor, indices, direction) {
  if (!editor || editor.isDestroyed || !direction) return [];
  const doc = editor.state.doc;
  const sorted = normalizeBlockIndices(doc, indices);
  if (!sorted.length) return [];

  const selectedSet = new Set(sorted);
  const items = [];
  for (let i = 0; i < doc.childCount; i += 1) {
    items.push({ node: doc.child(i), selected: selectedSet.has(i) });
  }

  let changed = false;
  if (direction < 0) {
    for (let i = 1; i < items.length; i += 1) {
      if (items[i].selected && !items[i - 1].selected) {
        [items[i - 1], items[i]] = [items[i], items[i - 1]];
        changed = true;
      }
    }
  } else {
    for (let i = items.length - 2; i >= 0; i -= 1) {
      if (items[i].selected && !items[i + 1].selected) {
        [items[i], items[i + 1]] = [items[i + 1], items[i]];
        changed = true;
      }
    }
  }

  if (!changed) return sorted;

  const ok = editor
    .chain()
    .command(({ tr }) => {
      closeHistory(tr);
      tr.replaceWith(
        0,
        tr.doc.content.size,
        items.map((item) => item.node)
      );
      closeHistory(tr);
      return true;
    })
    .run();

  if (!ok) return sorted;
  const nextIndices = [];
  items.forEach((item, idx) => {
    if (item.selected) nextIndices.push(idx);
  });
  return nextIndices;
}

export function copyBlocksText(editor, indices) {
  if (!editor || editor.isDestroyed) return "";
  const doc = editor.state.doc;
  const sorted = normalizeBlockIndices(doc, indices);
  if (!sorted.length) return "";

  const parts = sorted.map((idx) => {
    const node = doc.child(idx);
    if (node.type.name === "webBookmark") {
      const title = String(node.attrs?.title || "").trim();
      const url = String(node.attrs?.url || "").trim();
      return title && url && title !== url ? `${title} (${url})` : url || title || "";
    }
    return node.textContent || "";
  });
  const nonEmpty = parts.filter((part) => part.length > 0);
  const text = (nonEmpty.length ? nonEmpty : parts).join("\n\n");
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch?.(() => {});
  }
  return text;
}

const EXCLUDED_SELECTOR =
  ".nf-table-panel, .nf-bubble, .nf-link-popover, .nf-math-popover, .nf-multi-bar, .nf-link-hover, a.nf-link, .nf-link-block-edit, .nf-math-widget, button, input, textarea, select";

export function attachEditorBlockControls(editor, host, { onScrollRequest } = {}) {
  if (!editor || !host || typeof document === "undefined") {
    const noop = () => {};
    noop.focusBottom = () => focusEditorBottom(editor);
    return noop;
  }

  let frame = null;
  let ignoreClickUntil = 0;
  let selectedBlocks = new Set();
  let lastDown = null;
  let marqueePending = null;
  let decoRevision = "";

  const marqueeEl = document.createElement("div");
  marqueeEl.className = "nf-marquee";
  marqueeEl.hidden = true;

  const multiBar = document.createElement("div");
  multiBar.className = "nf-multi-bar";
  multiBar.setAttribute("role", "toolbar");
  multiBar.setAttribute("aria-label", "Acciones para bloques seleccionados");
  multiBar.hidden = true;

  const multiCountEl = document.createElement("span");
  multiCountEl.className = "nf-multi-count";

  const makeMultiBtn = (className, text, label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `nf-multi-btn ${className}`;
    btn.textContent = text;
    btn.setAttribute("aria-label", label);
    btn.title = label;
    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    return btn;
  };
  const multiUpBtn = makeMultiBtn("nf-multi-up", "↑", "Subir bloques");
  const multiDownBtn = makeMultiBtn("nf-multi-down", "↓", "Bajar bloques");
  const multiDupBtn = makeMultiBtn("nf-multi-dup", "Duplicar", "Duplicar bloques");
  const multiCopyBtn = makeMultiBtn("nf-multi-copy", "Copiar", "Copiar bloques");
  const multiDelBtn = makeMultiBtn("nf-multi-del", "Eliminar", "Eliminar bloques");
  multiBar.append(multiCountEl, multiUpBtn, multiDownBtn, multiDupBtn, multiCopyBtn, multiDelBtn);
  host.append(marqueeEl, multiBar);

  const buildSelectionDecos = (doc) => {
    if (!selectedBlocks.size) return DecorationSet.empty;
    const decos = [];
    let pos = 0;
    for (let i = 0; i < doc.childCount; i += 1) {
      const child = doc.child(i);
      if (selectedBlocks.has(i)) {
        decos.push(
          Decoration.node(pos, pos + child.nodeSize, {
            "data-nf-block-selected": "true",
          })
        );
      }
      pos += child.nodeSize;
    }
    return decos.length ? DecorationSet.create(doc, decos) : DecorationSet.empty;
  };

  const multiSelectPlugin = new Plugin({
    key: multiSelectKey,
    props: {
      decorations(state) {
        return buildSelectionDecos(state.doc);
      },
    },
  });
  editor.registerPlugin?.(multiSelectPlugin);

  const syncSelectionDom = () => {
    const count = editor.state.doc.childCount;
    const next = new Set();
    for (const idx of selectedBlocks) {
      if (idx >= 0 && idx < count) next.add(idx);
    }
    selectedBlocks = next;
    const sig = Array.from(selectedBlocks)
      .sort((a, b) => a - b)
      .join(",");
    if (sig !== decoRevision && !editor.isDestroyed) {
      decoRevision = sig;
      editor.view.dispatch(editor.state.tr.setMeta(multiSelectKey, sig).setMeta("addToHistory", false));
    }
  };

  const positionBar = () => {
    if (!selectedBlocks.size || marqueePending?.active || multiBar.hidden || !host.isConnected) return;
    const blocks = Array.from(editor.view.dom.children);
    const firstIdx = Math.min(...selectedBlocks);
    const anchorBlock = blocks[firstIdx];
    if (!anchorBlock) return;
    const root = host.getBoundingClientRect();
    const anchor = anchorBlock.getBoundingClientRect();
    const maxWidth = Math.max(220, (root.width || 320) - 16);
    multiBar.style.maxWidth = `${maxWidth}px`;
    multiBar.style.left = "8px";
    positionEditorPanel(host, multiBar, anchor, true, 8);
  };

  const schedule = () => {
    if (frame != null) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = null;
      if (editor.isDestroyed || !host.isConnected) return;
      syncSelectionDom();
      positionBar();
    });
  };

  const syncMultiBar = () => {
    syncSelectionDom();
    const sorted = Array.from(selectedBlocks).sort((a, b) => a - b);
    if (!sorted.length) {
      multiBar.hidden = true;
      host.classList.remove("nf-multi-selecting");
      host.dispatchEvent(new Event("nf:layout"));
      return;
    }
    const blocks = Array.from(editor.view.dom.children);
    multiCountEl.textContent = sorted.length === 1 ? "1 bloque" : `${sorted.length} bloques`;
    multiUpBtn.disabled = sorted[sorted.length - 1] === sorted.length - 1;
    multiDownBtn.disabled = sorted[0] === blocks.length - sorted.length;
    host.classList.add("nf-multi-selecting");
    multiBar.hidden = false;
    positionBar();
    host.dispatchEvent(new Event("nf:layout"));
  };

  const clearMultiSelection = () => {
    marqueeEl.hidden = true;
    marqueePending = null;
    if (!selectedBlocks.size && !host.classList.contains("nf-multi-selecting") && multiBar.hidden) return;
    selectedBlocks = new Set();
    syncSelectionDom();
    multiBar.hidden = true;
    host.classList.remove("nf-multi-selecting");
    host.dispatchEvent(new Event("nf:layout"));
  };

  const setMultiSelection = (indices) => {
    selectedBlocks = new Set(normalizeBlockIndices(editor.state.doc, indices));
    syncMultiBar();
    schedule();
  };

  multiUpBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const next = moveBlocks(editor, Array.from(selectedBlocks), -1);
    setMultiSelection(next);
  });
  multiDownBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const next = moveBlocks(editor, Array.from(selectedBlocks), 1);
    setMultiSelection(next);
  });
  multiDupBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    const next = duplicateBlocks(editor, Array.from(selectedBlocks));
    setMultiSelection(next);
  });
  multiCopyBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    copyBlocksText(editor, Array.from(selectedBlocks));
  });
  multiDelBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteBlocks(editor, Array.from(selectedBlocks));
    clearMultiSelection();
    editor.view.focus();
  });

  const blockIndexForTarget = (target, clientY) => {
    const blocks = Array.from(editor.view.dom.children);
    if (!blocks.length) return -1;
    let node = target;
    while (node && node.parentElement !== editor.view.dom) {
      node = node.parentElement;
    }
    if (node) {
      const idx = blocks.indexOf(node);
      if (idx !== -1) return idx;
    }
    if (typeof clientY === "number" && (clientY > 0 || !node)) {
      const rects = blocks.map((child) => child.getBoundingClientRect());
      return blockAtY(rects, clientY);
    }
    return -1;
  };

  const shouldFocusBottomOnClick = (event) => {
    if (!editor.isEditable || Date.now() < ignoreClickUntil) return false;
    if (selectedBlocks.size > 0 || event.shiftKey) return false;
    if (event.target?.closest?.(EXCLUDED_SELECTOR)) return false;
    const blocks = Array.from(editor.view.dom.children);
    if (!blocks.length) return true;
    const lastBlock = blocks[blocks.length - 1];
    const lastRect = lastBlock.getBoundingClientRect?.();
    if (!lastRect) return false;
    if (typeof event.clientY === "number" && (event.clientY > 0 || event.clientX > 0)) {
      return event.clientY > lastRect.bottom + 2;
    }
    return event.target === host || event.target === editor.view.dom;
  };

  const handleShiftBlockClick = (event) => {
    if (!editor.isEditable || !event.shiftKey || Date.now() < ignoreClickUntil) return false;
    if (event.target?.closest?.(EXCLUDED_SELECTOR)) return false;
    const blocks = Array.from(editor.view.dom.children);
    if (!blocks.length) return false;
    const idx = blockIndexForTarget(event.target, event.clientY);
    if (idx < 0) return false;

    const hitRect = blocks[idx]?.getBoundingClientRect?.();
    const onAtomBlock = Boolean(event.target?.closest?.(".nf-link-block") || ["IMG", "HR"].includes(event.target?.tagName));
    const onLeftMargin = Boolean(hitRect && hitRect.right > hitRect.left && event.clientX < hitRect.left + 6);
    if (!selectedBlocks.size && !onAtomBlock && !onLeftMargin) return false;

    event.preventDefault();
    event.stopPropagation();
    window.getSelection?.()?.removeAllRanges?.();
    host.dispatchEvent(new Event("nf:dismiss-controls"));
    if (selectedBlocks.has(idx)) selectedBlocks.delete(idx);
    else selectedBlocks.add(idx);
    syncMultiBar();
    schedule();
    return true;
  };

  const onHostClick = (event) => {
    if (handleShiftBlockClick(event)) return;
    if (event.target !== host) return;
    if (shouldFocusBottomOnClick(event)) focusEditorBottom(editor);
  };

  const onEditorClick = (event) => {
    if (Date.now() < ignoreClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (handleShiftBlockClick(event)) return;
    if (shouldFocusBottomOnClick(event)) {
      focusEditorBottom(editor);
    }
  };

  const onDocClick = (event) => {
    if (multiBar.contains(event.target)) return;
    if (selectedBlocks.size > 0 && Date.now() >= ignoreClickUntil && !event.shiftKey) {
      clearMultiSelection();
    }
  };

  const onBeforeInput = () => {
    clearMultiSelection();
  };

  const onMultiKeyDown = (event) => {
    if (!selectedBlocks.size) return;
    const tag = typeof document !== "undefined" ? document.activeElement?.tagName : "";
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      clearMultiSelection();
      return;
    }
    if ((event.key === "Backspace" || event.key === "Delete") && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      deleteBlocks(editor, Array.from(selectedBlocks));
      clearMultiSelection();
      editor.view.focus();
      return;
    }
    const mod = event.ctrlKey || event.metaKey;
    const lower = event.key.toLowerCase();
    if (mod && lower === "d") {
      event.preventDefault();
      event.stopPropagation();
      const next = duplicateBlocks(editor, Array.from(selectedBlocks));
      setMultiSelection(next);
      return;
    }
    if (mod && lower === "c") {
      event.preventDefault();
      event.stopPropagation();
      copyBlocksText(editor, Array.from(selectedBlocks));
      return;
    }
    if (mod && lower === "x") {
      event.preventDefault();
      event.stopPropagation();
      copyBlocksText(editor, Array.from(selectedBlocks));
      deleteBlocks(editor, Array.from(selectedBlocks));
      clearMultiSelection();
      editor.view.focus();
      return;
    }
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      event.stopPropagation();
      const next = moveBlocks(editor, Array.from(selectedBlocks), event.key === "ArrowUp" ? -1 : 1);
      setMultiSelection(next);
    }
  };

  const isMarqueeExcludedTarget = (target) => Boolean(target?.closest?.(EXCLUDED_SELECTOR));

  const onMarqueePointerDown = (event) => {
    if (
      !editor.isEditable ||
      event.button !== 0 ||
      event.isPrimary === false ||
      event.pointerType === "touch" ||
      isMarqueeExcludedTarget(event.target)
    ) {
      lastDown = null;
      return;
    }
    const now = Date.now();
    const isDoublePress =
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      lastDown &&
      now - lastDown.time <= 380 &&
      Math.hypot(event.clientX - lastDown.x, event.clientY - lastDown.y) <= 18;
    lastDown = isDoublePress ? null : { time: now, x: event.clientX, y: event.clientY };

    const blocks = Array.from(editor.view.dom.children);
    const lastRect = blocks.length ? blocks[blocks.length - 1].getBoundingClientRect?.() : null;
    const hitBlock =
      blocks.find((block) => {
        const rect = block.getBoundingClientRect?.();
        return rect && event.clientY >= rect.top && event.clientY <= rect.bottom;
      }) || blocks[blocks.length - 1];
    const hitRect = hitBlock?.getBoundingClientRect?.();
    const isEmptyArea =
      event.target === host ||
      event.target === editor.view.dom ||
      Boolean(lastRect && event.clientY > lastRect.bottom + 2) ||
      Boolean(event.target?.closest?.(".nf-link-block")) ||
      Boolean(hitRect && hitRect.right > hitRect.left && event.clientX < hitRect.left + 6);

    if (!isEmptyArea && !isDoublePress) return;
    marqueePending = {
      startX: event.clientX,
      startY: event.clientY,
      curX: event.clientX,
      curY: event.clientY,
      pointerId: event.pointerId,
      threshold: isDoublePress ? 8 : 6,
      baseSelection: event.shiftKey ? new Set(selectedBlocks) : new Set(),
      scrolledAt: 0,
      active: false,
    };
  };

  const onMarqueePointerMove = (event) => {
    if (!marqueePending || event.pointerId !== marqueePending.pointerId) return;
    const dist = Math.hypot(event.clientX - marqueePending.startX, event.clientY - marqueePending.startY);
    if (!marqueePending.active) {
      if (dist <= marqueePending.threshold) return;
      marqueePending.active = true;
      multiBar.hidden = true;
      host.dispatchEvent(new Event("nf:dismiss-controls"));
    }
    event.preventDefault();
    window.getSelection?.()?.removeAllRanges?.();
    marqueePending.curX = event.clientX;
    marqueePending.curY = event.clientY;

    const root = host.getBoundingClientRect();
    const selLeft = Math.min(marqueePending.startX, marqueePending.curX);
    const selRight = Math.max(marqueePending.startX, marqueePending.curX);
    const selTop = Math.min(marqueePending.startY, marqueePending.curY);
    const selBottom = Math.max(marqueePending.startY, marqueePending.curY);

    marqueeEl.hidden = false;
    marqueeEl.style.left = `${selLeft - root.left}px`;
    marqueeEl.style.top = `${selTop - root.top}px`;
    marqueeEl.style.width = `${Math.max(2, selRight - selLeft)}px`;
    marqueeEl.style.height = `${Math.max(2, selBottom - selTop)}px`;

    const next = new Set(marqueePending.baseSelection);
    Array.from(editor.view.dom.children).forEach((block, index) => {
      const rect = block.getBoundingClientRect();
      const yOverlap = rect.bottom >= selTop && rect.top <= selBottom;
      const xOverlap = rect.right <= rect.left || (rect.right >= selLeft && rect.left <= selRight);
      if (yOverlap && xOverlap) next.add(index);
    });
    selectedBlocks = next;
    syncSelectionDom();

    const visible = visibleEditorBounds(host);
    const y = event.clientY - root.top;
    const delta = y < visible.top + 28 ? -24 : y > visible.bottom - 28 ? 24 : 0;
    if (delta && Date.now() - marqueePending.scrolledAt > 80) {
      marqueePending.scrolledAt = Date.now();
      onScrollRequest?.(delta);
    }
  };

  const onMarqueePointerUp = (event) => {
    if (!marqueePending || event.pointerId !== marqueePending.pointerId) return;
    const finished = marqueePending;
    marqueePending = null;
    marqueeEl.hidden = true;
    if (!finished.active) return;
    if (event.type === "pointercancel") {
      clearMultiSelection();
      return;
    }
    if (selectedBlocks.size > 0) {
      ignoreClickUntil = Date.now() + 250;
      window.getSelection?.()?.removeAllRanges?.();
      syncMultiBar();
      schedule();
    } else {
      ignoreClickUntil = Date.now() + 150;
      clearMultiSelection();
    }
  };

  const onBlur = () => {
    // No borramos al soltar brevemente foco durante botones del multiBar;
    // onDocClick / Escape manejan la limpieza.
    schedule();
  };

  editor.on("transaction", schedule);
  editor.on("focus", schedule);
  editor.on("blur", onBlur);
  host.addEventListener("pointerdown", onMarqueePointerDown);
  host.addEventListener("click", onHostClick);
  editor.view.dom.addEventListener("click", onEditorClick);
  editor.view.dom.addEventListener("beforeinput", onBeforeInput);
  host.addEventListener("nf:viewport", schedule);
  window.addEventListener("pointermove", onMarqueePointerMove);
  window.addEventListener("pointerup", onMarqueePointerUp);
  window.addEventListener("pointercancel", onMarqueePointerUp);
  window.addEventListener("keydown", onMultiKeyDown, true);
  document.addEventListener("pointerdown", onDocClick);

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
  observer?.observe(host);
  schedule();

  const cleanup = () => {
    clearMultiSelection();
    if (!editor.isDestroyed) editor.unregisterPlugin?.(multiSelectKey);
    if (frame != null) cancelAnimationFrame(frame);
    observer?.disconnect();
    editor.off("transaction", schedule);
    editor.off("focus", schedule);
    editor.off("blur", onBlur);
    host.removeEventListener("pointerdown", onMarqueePointerDown);
    host.removeEventListener("click", onHostClick);
    editor.view.dom.removeEventListener("click", onEditorClick);
    editor.view.dom.removeEventListener("beforeinput", onBeforeInput);
    host.removeEventListener("nf:viewport", schedule);
    window.removeEventListener("pointermove", onMarqueePointerMove);
    window.removeEventListener("pointerup", onMarqueePointerUp);
    window.removeEventListener("pointercancel", onMarqueePointerUp);
    window.removeEventListener("keydown", onMultiKeyDown, true);
    document.removeEventListener("pointerdown", onDocClick);
    marqueeEl.remove();
    multiBar.remove();
  };

  cleanup.focusBottom = () => focusEditorBottom(editor);
  cleanup.clearSelection = clearMultiSelection;
  return cleanup;
}
