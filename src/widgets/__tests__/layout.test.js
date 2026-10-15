import { decksLayout, reviewLayout } from '../layout';

const data = { inProgress: [{ id: 1 }], recent: Array.from({ length: 12 }, (_, i) => ({ id: i + 2 })) };
const sizes = [[180, 132], [180, 154], [240, 154], [320, 180], [320, 240], [320, 340], [400, 500], [500, 200]];
test.each(sizes)('repaso cabe en %i × %i, con controles visibles', (width, height) => {
  const l = reviewLayout({ width, height });
  expect(l.heroHeight + l.statHeight + l.barHeight + l.gap * 2).toBeLessThanOrEqual(l.bodyHeight);
  expect(l.padding * 2 + l.headerHeight + l.headerGap + l.bodyHeight + l.footerGap + l.buttonHeight).toBe(height);
});
test.each(sizes.filter(([, h]) => h >= 154))('mazos caben en %i × %i sin cortar las filas', (width, height) => {
  const l = decksLayout({ width, height }, data);
  const count = l.sections.reduce((n, section) => n + section.decks.length, 0);
  expect(l.nameHeight + l.detailHeight + 4).toBeLessThanOrEqual(l.rowHeight);
  expect(count * l.rowHeight + (l.sections.length === 2 ? l.sectionHeight : 0)).toBeLessThanOrEqual(l.bodyHeight);
});
test('tamaño de la captura agranda contenido y agrega recientes; más alto muestra más', () => {
  const review = reviewLayout({ width: 320, height: 340 });
  expect(review.heroSize).toBeGreaterThanOrEqual(80);
  expect(review.buttonSize).toBeGreaterThanOrEqual(17);
  const medium = decksLayout({ width: 320, height: 340 }, data);
  expect(medium.nameSize).toBeGreaterThanOrEqual(19);
  expect(medium.sections.map((s) => s.mode)).toEqual(['progress', 'recent']);
  const large = decksLayout({ width: 320, height: 600 }, data);
  expect(large.hidden).toBeLessThan(medium.hidden);
});
test('reserva recientes incluso con muchos mazos en progreso y no duplica filas', () => {
  const l = decksLayout({ width: 320, height: 340 }, { inProgress: data.recent, recent: data.inProgress });
  expect(l.sections.map((s) => s.mode)).toEqual(['progress', 'recent']);
  expect(l.sections[1].decks).toEqual(data.inProgress);
});
