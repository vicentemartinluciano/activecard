export function studyKeyAction(event, flipped) {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return null;
  if (event.key === ' ') return 'flip';
  if (!flipped) return null;
  return ({ '1': 'again', ArrowLeft: 'again', '2': 'hard', ArrowUp: 'hard', '3': 'good', ArrowRight: 'good' })[event.key] || null;
}
