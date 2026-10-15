import { colors, gradients, radius } from '../theme';

export function widgetBackdrop(width, height, hero = true) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="base" x2="1" y2="1">${gradients.hero.map((color, i) => `<stop offset="${i / (gradients.hero.length - 1)}" stop-color="${color}"/>`).join('')}</linearGradient></defs>
    <rect width="${width}" height="${height}" rx="${radius.lg}" fill="${hero ? 'url(#base)' : colors.surfaceCard}"/>
  </svg>`;
}

export function progressArt(width, height, pct, animated = false, green = false) {
  const value = Math.max(0, Math.min(100, pct || 0));
  const fill = Math.round(width * value / 100);
  const gradient = green ? gradients.progress : gradients.bar;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"${animated && fill > 0 ? ` data-activecard-progress="${value}"` : ''}>
    <defs><linearGradient id="fill"><stop stop-color="${gradient[0]}"/><stop offset="1" stop-color="${gradient[1]}"/></linearGradient></defs>
    <rect width="${width}" height="${height}" rx="${height / 2}" fill="${colors.track}"/>
    ${fill > 0 ? `<rect width="${Math.max(1, fill)}" height="${height}" rx="${height / 2}" fill="url(#fill)"/>` : ''}
  </svg>`;
}

export const chevronMark = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="m6 4 4 4-4 4" fill="none" stroke="${colors.textMuted}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
