const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function widgetChrome({ width = 320, height = 240 }) {
  const compact = height < 180 || width < 240;
  const padding = Math.round(clamp(Math.min(width * 0.05, height * 0.06), 8, 24));
  return { width, height, compact, padding, contentWidth: width - padding * 2 };
}

// El botón termina en el margen inferior. El espacio extra separa el contenido,
// en vez de quedar fuera de un grupo centrado que parece comprimido.
export function reviewLayout(info) {
  const l = widgetChrome(info);
  const titleSize = clamp(l.width * 0.07, 14, clamp(l.height * 0.1 + 8, 21, 30));
  const flameSize = clamp(l.height * 0.075 + 12, 22, 38);
  const captionHeight = clamp(l.height * 0.03 + 8, 12, 16);
  const headerHeight = Math.max(titleSize * 1.25, flameSize + captionHeight);
  const statSize = l.width < 240 ? 10 : clamp(l.width * 0.04, 11, 16);
  const statHeight = clamp(l.height * 0.12, 22, 40);
  const barHeight = clamp(l.width * 0.055, 12, clamp(l.height * 0.07 + 3, 12, 24));
  const buttonHeight = clamp(l.height * 0.18, 32, 56);
  const buttonSize = l.width < 240 ? 11 : Math.round(clamp(l.width * 0.045, 13, 18));
  const groupHeight = l.height - l.padding * 2;
  const free = groupHeight - headerHeight - statHeight - barHeight - buttonHeight;
  return { ...l, titleSize, flameSize, captionHeight, headerHeight,
    statsGap: free * 0.45, barGap: free * 0.2, buttonGap: free * 0.35,
    badgeWidth: l.width < 240 ? 34 : 48, statSize, statHeight, barHeight, buttonHeight,
    buttonSize, groupHeight, abbreviated: l.width < 270 };
}

// La altura define el viewport, nunca elimina mazos del contenido desplazable.
export function decksLayout(info) {
  const l = widgetChrome(info);
  const bodyHeight = l.height - l.padding * 2;
  const lines = bodyHeight >= 140 && l.width >= 240 && l.width < 340 ? 2 : 1;
  const nameSize = l.compact ? 14 : Math.round(clamp(l.width * 0.045, 16, 20));
  const nameHeight = Math.ceil(nameSize * 1.25) * lines;
  const detailSize = l.compact ? 11 : 13;
  const detailHeight = Math.ceil(detailSize * 1.3);
  const rowPadding = l.compact ? 6 : 10;
  const rowGap = l.compact ? 4 : 6;
  const rowHeight = Math.min(bodyHeight, nameHeight + detailHeight + rowPadding * 2 + 4 + rowGap);
  return { ...l, bodyHeight, lines, nameSize, nameHeight, detailSize, detailHeight, rowPadding,
    rowGap, rowHeight, sectionHeight: Math.min(22, bodyHeight) };
}

export function combinedLayout({ width = 320, height = 340 }) {
  const gap = 8;
  const reviewHeight = Math.round(clamp(height * 0.48, 132, 240));
  return { width, height, gap, reviewHeight, decksHeight: height - reviewHeight - gap };
}
