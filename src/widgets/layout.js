const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function widgetChrome({ width = 320, height = 240 }) {
  const compact = height < 180 || width < 240;
  const padding = height < 150 ? 8 : Math.round(clamp(Math.min(width * 0.05, height * 0.075), 8, 24));
  return { width, height, compact, padding, contentWidth: width - padding * 2 };
}

// Un grupo centrado, sin un bloque que absorba toda la altura sobrante.
export function reviewLayout(info) {
  const l = widgetChrome(info);
  const tight = l.height < 180;
  const medium = l.height < 220;
  const gap = tight ? 4 : medium ? 6 : Math.round(clamp(l.height * 0.045, 8, 20));
  const titleSize = Math.round(clamp(l.width * 0.07, 14, tight ? 21 : medium ? 24 : 30));
  const flameSize = tight ? 22 : medium ? 28 : Math.round(clamp(l.width * 0.1, 26, 42));
  const captionHeight = tight ? 12 : medium ? 14 : 16;
  const headerHeight = Math.max(titleSize * 1.25, flameSize + captionHeight);
  const statSize = tight || l.width < 240 ? 10 : Math.round(clamp(l.width * 0.04, 11, 16));
  const statHeight = tight ? 24 : medium ? 28 : Math.round(clamp(l.height * 0.12, 28, 40));
  const barHeight = tight ? 12 : medium ? 16 : Math.round(clamp(l.width * 0.055, 16, 24));
  const buttonHeight = tight ? 32 : medium ? 40 : Math.round(clamp(l.height * 0.2, 42, 60));
  const buttonSize = tight || l.width < 240 ? 11 : Math.round(clamp(l.width * 0.045, 13, 18));
  const groupHeight = headerHeight + statHeight + barHeight + buttonHeight + gap * 3;
  const inset = Math.max(0, (l.height - l.padding * 2 - groupHeight) / 2);
  return { ...l, gap, titleSize, flameSize, captionHeight, headerHeight,
    badgeWidth: tight ? 30 : 48, statSize, statHeight, barHeight, buttonHeight,
    buttonSize, groupHeight, inset, abbreviated: l.width < 270 };
}

// La altura define el viewport, nunca elimina mazos del contenido desplazable.
export function decksLayout(info) {
  const l = widgetChrome(info);
  const headerHeight = l.compact ? 24 : 34;
  const footerHeight = 20;
  const gap = l.compact ? 4 : 8;
  const bodyHeight = l.height - l.padding * 2 - headerHeight - footerHeight - gap * 2;
  const lines = bodyHeight >= 120 && l.width >= 240 ? 2 : 1;
  const nameSize = l.compact ? 14 : Math.round(clamp(l.width * 0.045, 16, 20));
  const nameHeight = Math.ceil(nameSize * 1.25) * lines;
  const detailSize = l.compact ? 11 : 13;
  const detailHeight = Math.ceil(detailSize * 1.3);
  const rowPadding = l.compact ? 6 : 10;
  const rowGap = l.compact ? 4 : 6;
  const rowHeight = Math.min(bodyHeight, nameHeight + detailHeight + rowPadding * 2 + 4 + rowGap);
  return { ...l, titleSize: l.compact ? 16 : 21, headerHeight, footerHeight, gap,
    bodyHeight, lines, nameSize, nameHeight, detailSize, detailHeight, rowPadding,
    rowGap, rowHeight, sectionHeight: Math.min(22, bodyHeight) };
}

export function combinedLayout({ width = 320, height = 340 }) {
  const gap = 8;
  const reviewHeight = Math.round(clamp(height * 0.48, 132, 240));
  return { width, height, gap, reviewHeight, decksHeight: height - reviewHeight - gap };
}
