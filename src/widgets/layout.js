const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Medidas en dp del host. Presupuestar también textos y controles evita que
// el contenido se desborde o quede diminuto al cambiar el tamaño del widget.
export function widgetChrome({ width = 320, height = 240 }) {
  const compact = height < 240;
  const padding = compact ? 8 : Math.round(clamp(width * 0.045, 12, 20));
  const titleSize = compact ? 14 : Math.round(clamp(width * 0.058, 16, 24));
  const headerHeight = compact ? 28 : Math.ceil(titleSize * 1.5 + 8);
  return { width, height, compact, padding, titleSize, headerHeight,
    iconSize: compact ? 22 : Math.min(34, headerHeight - 6),
    contentWidth: width - padding * 2,
    headerGap: compact ? 4 : 12, footerGap: compact ? 6 : 10 };
}

export function reviewLayout(info) {
  const chrome = widgetChrome(info);
  const { width, height, contentWidth, padding } = chrome;
  const compact = chrome.compact;
  const stacked = width < 260;
  const buttonHeight = compact ? 32 : Math.round(clamp(height * 0.2, 46, 64));
  const buttonSize = compact ? 14 : Math.round(clamp(width * 0.068, 18, 24));
  const statSize = compact ? 11 : Math.round(clamp(width * 0.06, 17, 23));
  const statHeight = Math.ceil(statSize * 1.4 + 2);
  const barHeight = compact ? 12 : Math.round(clamp(width * 0.075, 20, 28));
  const gap = compact ? 4 : 12;
  const heroSize = compact ? (height < 150 && stacked ? 18 : 28) : Math.round(clamp(width * 0.16, 36, 56));
  const pendingSize = compact ? 11 : Math.round(clamp(width * 0.065, 17, 24));
  const requestedFlameSize = compact ? 26 : 42;
  const badgeWidth = compact ? 40 : 60;
  const bodyHeight = height - padding * 2 - statHeight - barHeight - buttonHeight - gap * 3;
  const topInset = compact ? 0 : Math.min(12, Math.floor(bodyHeight * 0.1));
  const flameSize = Math.min(requestedFlameSize, bodyHeight - topInset - (compact ? 16 : 20));
  const heroHeight = Math.min(bodyHeight - topInset, Math.ceil(heroSize * 1.4) + (stacked ? Math.ceil(pendingSize * 1.4) : 0));
  return { ...chrome, compact, stacked, buttonHeight, buttonSize, statSize,
    statHeight, barHeight, gap, heroSize, heroHeight, bodyHeight, pendingSize,
    flameSize, badgeWidth, topInset, counterWidth: contentWidth - badgeWidth - 8 };
}

export function decksLayout(info, { inProgress = [], recent = [] }) {
  const chrome = widgetChrome(info);
  const { width, height, padding, headerHeight, headerGap, footerGap, compact } = chrome;
  const footerHeight = compact ? 20 : 28;
  const bodyHeight = height - padding * 2 - headerHeight - headerGap - footerHeight - footerGap;
  const compactRows = height < 300 || width < 250;
  const nameSize = Math.round(clamp(width * (compactRows ? 0.052 : 0.06), 14, height < 154 ? 18 : 24));
  const detailSize = Math.round(clamp(nameSize * 0.78, 11, 18));
  const oneLineHeight = Math.ceil(nameSize * 1.4);
  const detailHeight = Math.ceil(detailSize * 1.4 + 2);
  const minRowHeight = compactRows ? Math.max(46, oneLineHeight + detailHeight + 8)
    : oneLineHeight * 2 + detailHeight + 12;
  const sectionHeight = compactRows ? 20 : 26;
  const mixed = inProgress.length > 0 && recent.length > 0;
  let capacity = clamp(Math.floor((bodyHeight - (mixed ? sectionHeight : 0)) / minRowHeight), 1, 8);
  const showRecent = mixed && capacity >= 2;
  if (mixed && !showRecent) capacity = 1;
  const progressCount = inProgress.length === 0 ? 0 : Math.min(inProgress.length,
    showRecent ? Math.min(capacity - 1, Math.max(1, Math.ceil(capacity * 0.6))) : capacity);
  const recentCount = inProgress.length === 0 ? Math.min(recent.length, capacity)
    : showRecent ? Math.min(recent.length, capacity - progressCount) : 0;
  const sections = [];
  if (progressCount) sections.push({ mode: 'progress', decks: inProgress.slice(0, progressCount) });
  if (recentCount) sections.push({ mode: 'recent', decks: recent.slice(0, recentCount) });
  const count = progressCount + recentCount;
  const sectionSpace = sections.length === 2 ? sectionHeight : 0;
  const rowHeight = Math.max(1, Math.min(Math.round(minRowHeight * 1.45), Math.floor((bodyHeight - sectionSpace) / Math.max(1, count))));
  const lines = rowHeight >= oneLineHeight * 2 + detailHeight + 12 ? 2 : 1;
  const nameHeight = oneLineHeight * lines;
  return { ...chrome, bodyHeight, footerHeight, sections, rowHeight, sectionHeight,
    nameSize, detailSize, nameHeight, detailHeight, lines,
    title: inProgress.length ? (width < 250 ? 'Mazos' : 'Mazos en progreso') : 'Mazos recientes',
    hidden: inProgress.length + recent.length - count };
}
