export function widgetBackdrop(width, height) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="base" x2="1" y2="1"><stop stop-color="#151C35"/><stop offset="1" stop-color="#09090B"/></linearGradient>
      <radialGradient id="light" cx="90%" cy="0%" r="90%"><stop stop-color="#3E63DD" stop-opacity=".32"/><stop offset="1" stop-color="#3E63DD" stop-opacity="0"/></radialGradient>
      <linearGradient id="edge"><stop stop-color="#7C9AFF" stop-opacity="0"/><stop offset=".6" stop-color="#B7CAFF" stop-opacity=".75"/><stop offset="1" stop-color="#7C9AFF" stop-opacity="0"/></linearGradient>
    </defs>
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="24" fill="url(#base)"/>
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="24" fill="url(#light)" stroke="#354065" stroke-width="1"/>
    <path d="M 26 1 H ${width - 26}" fill="none" stroke="url(#edge)" stroke-width="1.5"/>
  </svg>`;
}

export const cardsMark = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect x="4" y="3" width="16" height="19" rx="4" fill="#7C9AFF" opacity=".35" transform="rotate(-12 12 12)"/><rect x="9" y="6" width="16" height="19" rx="4" fill="#3E63DD"/><path d="M13 12h8m-8 4h6" stroke="#ECF0FF" stroke-width="1.6" stroke-linecap="round"/></svg>`;

export const chevronMark = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="m6 4 4 4-4 4" fill="none" stroke="#9DAACB" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
