// No confundir la superficie accesible de estudio con los controles que
// contiene (estrella, editor, enlaces…), aunque ambos tengan role button.
export function isStudyControl(target) {
  const control = target?.closest?.('input, textarea, select, button, a, [role="button"], [role="link"], [contenteditable="true"], [data-study-action]');
  return !!control && !control.hasAttribute?.('data-study-flip');
}
