// Mismo lenguaje visual en lectura web y en ambos editores. Se reserva el
// espacio de la flecha: aparecer al pasar el cursor nunca desplaza el texto.
export const TOGGLE_CSS = `
.nf-toggle, .ac-toggle { position: relative; padding-left: 20px; margin: 5px 0; min-width: 0; text-align: left; }
.nf-toggle-summary { min-height: 32px; line-height: 1.5; padding: 4px 0; box-sizing: border-box; }
.nf-toggle-summary:has(> br:only-child)::before { content: attr(data-placeholder); color: #8B8B98; pointer-events: none; float: left; height: 0; }
.nf-toggle [data-type="toggle-content"], .ac-toggle-content { padding: 2px 0 4px; }
.nf-toggle:not(.is-open) > .nf-toggle-inner > [data-type="toggle-content"] { display: none; }
.ac-toggle-title { display: block; width: 100%; min-height: 32px; padding: 4px 0; box-sizing: border-box; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ac-toggle-arrow { position: absolute; left: -3px; top: 0; width: 22px; height: 32px; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 5px; padding: 0; background: transparent; color: #B7B7C2; cursor: pointer; }
.ac-toggle-arrow svg { display: block; width: 14px; height: 14px; opacity: .4; transition: opacity 140ms ease, transform 140ms ease; }
.is-open > .ac-toggle-arrow svg, .is-open > .ac-toggle-title .ac-toggle-arrow svg { transform: rotate(90deg); }
.ac-toggle-arrow:hover { background: #ffffff0b; }
.ac-toggle-arrow:focus-visible, .ac-toggle-title:focus-visible { outline: 2px solid #6E8BEB; outline-offset: 2px; border-radius: 4px; }
@media (hover: hover) and (pointer: fine) {
  .ac-toggle-arrow svg { opacity: 0; }
  .nf-toggle:hover > .ac-toggle-arrow svg,
  .nf-toggle > .ac-toggle-arrow:focus-visible svg,
  .ac-toggle:hover > .ac-toggle-title .ac-toggle-arrow svg,
  .ac-toggle > .ac-toggle-title:focus-visible .ac-toggle-arrow svg { opacity: .85; }
}
@media (hover: none), (pointer: coarse) {
  .nf-toggle-summary, .ac-toggle-title { min-height: 44px; padding-top: 10px; padding-bottom: 10px; }
  .ac-toggle-arrow { height: 44px; }
}
@media (prefers-reduced-motion: reduce) { .ac-toggle-arrow svg { transition: none; } }
`;
