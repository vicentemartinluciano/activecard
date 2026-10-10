export function studyKeyAction(event, flipped) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return null;
  if (event.key === ' ') return 'flip';
  if (!flipped) return null;
  return ({ '1': 'again', ArrowLeft: 'again', '2': 'hard', ArrowUp: 'hard', '3': 'good', ArrowRight: 'good' })[event.key] || null;
}

// Al avanzar con un botón, el navegador conserva allí el foco. Espacio lo
// volvería a activar y las flechas quedarían excluidas por el filtro de controles.
// Recuperamos el foco de estudio sin interrumpir escritura en otro campo.
export function focusStudyCard(node, activeElement) {
  if (activeElement?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  node?.focus?.({ preventScroll: true });
}
