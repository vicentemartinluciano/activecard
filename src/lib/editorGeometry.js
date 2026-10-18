// Coordenadas del documento del editor, recortadas por la pantalla y el teclado.
// En Android el viewport real lo informa el ScrollView que contiene al WebView.
export function visibleEditorBounds(host) {
  if (host.__nfViewport) return host.__nfViewport;
  const root = host.getBoundingClientRect();
  const visual = window.visualViewport;
  let top = visual?.offsetTop || 0;
  let bottom = top + (visual?.height || window.innerHeight);
  for (let parent = host.parentElement; parent; parent = parent.parentElement) {
    if (!/(auto|scroll|hidden|clip)/.test(getComputedStyle(parent).overflowY)) continue;
    const box = parent.getBoundingClientRect();
    top = Math.max(top, box.top);
    bottom = Math.min(bottom, box.bottom);
  }
  return { top: Math.max(0, top - root.top), bottom: Math.max(0, bottom - root.top) };
}

export function floatingPanelPosition({ top, bottom, anchorTop, anchorBottom, height, preferAbove = false }) {
  const start = Math.max(0, top) + 4;
  const end = Math.max(start + 44, bottom - 4);
  const above = Math.max(0, anchorTop - start - 8);
  const below = Math.max(0, end - anchorBottom - 8);
  const useAbove = (preferAbove && above >= height) || (below < height && above > below);
  const maxHeight = Math.max(44, end - start);
  const panelHeight = Math.min(height, maxHeight);
  const ideal = useAbove ? anchorTop - panelHeight - 8 : anchorBottom + 8;
  return { top: Math.max(start, Math.min(ideal, end - panelHeight)), maxHeight };
}

export function positionEditorPanel(host, panel, anchor, preferAbove = false) {
  const root = host.getBoundingClientRect();
  const viewport = visibleEditorBounds(host);
  panel.style.maxHeight = `${Math.max(44, viewport.bottom - viewport.top - 8)}px`;
  const height = panel.getBoundingClientRect().height;
  const position = floatingPanelPosition({
    ...viewport,
    anchorTop: anchor.top - root.top,
    anchorBottom: anchor.bottom - root.top,
    height,
    preferAbove,
  });
  panel.style.top = `${position.top}px`;
  panel.style.maxHeight = `${position.maxHeight}px`;
  host.dispatchEvent(new Event("nf:layout"));
}

// El dedo permanece en la columna de controles: usar Y, no elementFromPoint(X,Y).
export function blockAtY(rects, y) {
  if (!rects.length) return -1;
  const index = rects.findIndex((rect) => y < rect.bottom);
  return index < 0 ? rects.length - 1 : index;
}
