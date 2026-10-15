import { combinedLayout, decksLayout, reviewLayout } from '../layout';

test('el repaso cabe, centrado, también en las medidas reales de One UI', () => {
  const sizes = [[294, 218], [401, 218], [401, 340]];
  for (let width = 160; width <= 500; width += 20) {
    for (let height = 132; height <= 600; height += 2) sizes.push([width, height]);
  }
  for (const [width, height] of sizes) {
    const l = reviewLayout({ width, height });
    expect(l.groupHeight + l.padding * 2).toBeLessThanOrEqual(height);
    expect(l.groupHeight + l.padding * 2 + l.inset * 2).toBeCloseTo(height);
    expect(l.flameSize + l.captionHeight).toBeLessThanOrEqual(l.headerHeight);
  }
});

test('el viewport de mazos crece y cada elemento cabe en el mínimo', () => {
  for (let width = 160; width <= 500; width += 20) {
    for (let height = 132; height <= 600; height += 10) {
      const l = decksLayout({ width, height });
      expect(l.nameHeight + l.detailHeight + l.rowPadding * 2 + 4 + l.rowGap).toBeLessThanOrEqual(l.rowHeight);
      expect(l.rowHeight).toBeLessThanOrEqual(l.bodyHeight);
      expect(l.sectionHeight).toBeLessThanOrEqual(l.bodyHeight);
      expect(l.bodyHeight + l.headerHeight + l.footerHeight + l.gap * 2 + l.padding * 2).toBe(height);
    }
  }
  expect(decksLayout({ width: 401, height: 340 }).bodyHeight).toBeGreaterThan(decksLayout({ width: 401, height: 218 }).bodyHeight);
  const expanded = decksLayout({ width: 401, height: 340 });
  expect(expanded.sectionHeight * 2 + expanded.rowHeight * 2).toBeLessThanOrEqual(expanded.bodyHeight);
});

test('el combinado reserva dos paneles utilizables desde su mínimo nativo', () => {
  for (let height = 280; height <= 600; height += 10) {
    const l = combinedLayout({ width: 160, height });
    expect(l.reviewHeight).toBeGreaterThanOrEqual(132);
    expect(l.decksHeight).toBeGreaterThanOrEqual(132);
    expect(l.reviewHeight + l.decksHeight + l.gap).toBe(height);
  }
});
