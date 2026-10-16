import { combinedLayout, decksLayout, reviewLayout } from '../layout';

test('el repaso cabe con el botón en el margen inferior, también en One UI', () => {
  const sizes = [[294, 218], [401, 218], [401, 340]];
  for (let width = 160; width <= 500; width += 20) {
    for (let height = 132; height <= 600; height += 2) sizes.push([width, height]);
  }
  for (const [width, height] of sizes) {
    const l = reviewLayout({ width, height });
    expect(l.groupHeight + l.padding * 2).toBeLessThanOrEqual(height);
    expect(l.groupHeight + l.padding * 2).toBeCloseTo(height);
    const buttonBottom = l.padding + l.headerHeight + l.statsGap + l.statHeight + l.barGap + l.barHeight + l.buttonGap + l.buttonHeight;
    expect(buttonBottom).toBeCloseTo(height - l.padding);
    expect(Math.min(l.statsGap, l.barGap, l.buttonGap)).toBeGreaterThan(0);
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
      expect(l.bodyHeight + l.padding * 2).toBe(height);
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

test('el espacio agregado al ampliar separa el botón y evita saltos entre modos', () => {
  const short = reviewLayout({ width: 294, height: 218 });
  const tall = reviewLayout({ width: 294, height: 340 });
  expect(short.buttonGap).toBeGreaterThan(16);
  expect(tall.buttonGap).toBeGreaterThan(short.buttonGap);
  for (const height of [149, 179, 219]) {
    const before = reviewLayout({ width: 401, height });
    const after = reviewLayout({ width: 401, height: height + 1 });
    for (const key of ['headerHeight', 'statHeight', 'barHeight', 'buttonHeight', 'buttonGap']) {
      expect(Math.abs(after[key] - before[key])).toBeLessThan(2);
    }
  }
});
