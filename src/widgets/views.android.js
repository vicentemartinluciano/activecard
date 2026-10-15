import { FlexWidget, ListWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { colors, fontFamilies, radius } from '../theme';
import { chevronMark, progressArt, widgetBackdrop } from './art';
import { combinedLayout, decksLayout, reviewLayout, widgetChrome } from './layout';
import { widgetDeckUri } from './model';
import { flameFrame } from './flameFrame';

const openUri = (uri) => ({ clickAction: 'OPEN_URI', clickActionData: { uri } });
function Label({ text, size = 16, weight = 600, color = colors.text, lines = 1, fit = false, style = {} }) {
  return <TextWidget text={String(text)} maxLines={lines} truncate="END" allowFontScaling={false} style={{ fontFamily: fontFamilies[weight], fontWeight: String(weight), fontSize: size, color, adjustsFontSizeToFit: fit, ...style }} />;
}

function Shell({ layout: l, hero = true, accessibilityLabel, children }) {
  return <OverlapWidget accessibilityLabel={accessibilityLabel} style={{ width: l.width, height: l.height, borderRadius: radius.lg, overflow: 'hidden' }}>
    <SvgWidget svg={widgetBackdrop(l.width, l.height, hero)} style={{ width: l.width, height: l.height }} />
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', padding: l.padding }}>{children}</FlexWidget>
  </OverlapWidget>;
}

function StreakBadge({ streak, layout: l }) {
  const active = streak.activeToday && streak.days > 0;
  const days = `${streak.days} ${streak.days === 1 ? 'día' : 'días'}`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" xmlns:xlink="http://www.w3.org/1999/xlink" data-activecard-flame="${active ? 'active' : 'idle'}"><image width="128" height="128" opacity="${active ? 1 : 0.4}" xlink:href="${flameFrame}"/></svg>`;
  return <FlexWidget accessibilityLabel={`Racha de ${days}${active ? ', activa hoy' : ', pendiente de hoy'}`} style={{ width: l.badgeWidth, height: l.headerHeight, alignItems: 'center', justifyContent: 'center' }}>
    <SvgWidget svg={svg} style={{ width: l.flameSize, height: l.flameSize }} />
    <Label text={days} size={l.captionHeight === 12 ? 9 : 11} color={active ? colors.streak : colors.textMuted} fit style={{ height: l.captionHeight, width: l.badgeWidth, textAlign: 'center' }} />
  </FlexWidget>;
}

export function ReviewWidget({ info, data }) {
  const stats = data.review;
  const streak = data.streak || { days: 0, activeToday: false };
  const done = stats.remaining === 0 && stats.total > 0;
  const l = reviewLayout(info);
  const labels = [
    `${stats.remaining} ${l.abbreviated ? 'pend.' : stats.remaining === 1 ? 'pendiente' : 'pendientes'}`,
    `${stats.done} ${l.abbreviated ? 'hechas' : stats.done === 1 ? 'completada' : 'completadas'}`,
    `${stats.pct}%`,
  ];
  const weights = [labels[0].length + 2, labels[1].length + 2, labels[2].length + 2];
  const available = l.contentWidth - 8;
  const pillWidths = weights.map((weight) => Math.floor(available * weight / weights.reduce((a, b) => a + b, 0)));
  return <Shell layout={l} accessibilityLabel={`Repaso diario: ${stats.remaining} pendientes, ${stats.done} completadas, ${stats.pct}%. Racha de ${streak.days} ${streak.days === 1 ? 'día' : 'días'}.`}>
    <FlexWidget style={{ width: 'match_parent', height: l.groupHeight, marginTop: l.inset }}>
      <FlexWidget {...openUri('activecard:///repaso')} accessibilityLabel="Abrir repaso diario" style={{ width: 'match_parent', height: l.headerHeight, flexDirection: 'row', alignItems: 'center' }}>
        <Label text="Repaso de hoy" size={l.titleSize} weight={800} lines={l.width < 220 ? 2 : 1} fit style={{ width: l.contentWidth - l.badgeWidth - 8, height: l.headerHeight }} />
        <FlexWidget style={{ marginLeft: 8 }}><StreakBadge streak={streak} layout={l} /></FlexWidget>
      </FlexWidget>
      {done ? <Label text="Completado ✓" size={Math.min(l.titleSize, l.statHeight - 2)} weight={700} color={colors.successBright} style={{ height: l.statHeight, width: 'match_parent', marginTop: l.gap }} /> : <FlexWidget style={{ width: 'match_parent', height: l.statHeight, flexDirection: 'row', marginTop: l.gap }}>
        {labels.map((text, i) => <FlexWidget key={i} style={{ width: pillWidths[i], height: l.statHeight, marginRight: i < 2 ? 4 : 0, backgroundColor: colors.accentSoft, borderRadius: 999, justifyContent: 'center' }}>
          <Label text={text} size={l.statSize} color={colors.accentText} weight={700} fit style={{ width: 'match_parent', height: 'match_parent', textAlign: 'center', paddingHorizontal: l.width < 240 ? 2 : 5 }} />
        </FlexWidget>)}
      </FlexWidget>}
      <SvgWidget svg={progressArt(l.contentWidth, l.barHeight, stats.pct, true)} style={{ width: l.contentWidth, height: l.barHeight, marginTop: l.gap }} />
      <FlexWidget {...openUri('activecard:///repaso')} accessibilityLabel={done ? 'Repasar de nuevo' : 'Repasar ahora'} style={{ width: 'match_parent', height: l.buttonHeight, marginTop: l.gap, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <Label text={done ? 'REPASAR DE NUEVO' : 'REPASAR AHORA'} size={l.buttonSize} color={colors.bg} weight={800} fit style={{ width: 'match_parent', height: 'match_parent', textAlign: 'center', paddingHorizontal: 8 }} />
      </FlexWidget>
    </FlexWidget>
  </Shell>;
}

function DeckRow({ deck, mode, layout: l }) {
  const progress = mode === 'progress';
  const textWidth = l.contentWidth - l.rowPadding * 2 - 24;
  return <FlexWidget {...openUri(widgetDeckUri(deck.id, mode))} accessibilityLabel={`${progress ? 'Continuar' : 'Abrir'} ${deck.name}`} style={{ width: l.contentWidth, height: l.rowHeight }}>
    <FlexWidget style={{ width: 'match_parent', height: l.rowHeight - l.rowGap, padding: l.rowPadding, backgroundColor: colors.surfaceHigh, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget style={{ width: textWidth }}>
        <Label text={deck.name} size={l.nameSize} lines={l.lines} weight={600} style={{ width: textWidth, height: l.nameHeight }} />
        {progress ? <FlexWidget style={{ width: textWidth, height: l.detailHeight, flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <SvgWidget svg={progressArt(Math.max(10, textWidth - 40), 8, deck.progress.pct, false, true)} style={{ width: Math.max(10, textWidth - 40), height: 8 }} />
          <Label text={`${deck.progress.pct}%`} size={l.detailSize} color={colors.accentText} fit style={{ width: 36, height: l.detailHeight, textAlign: 'center', marginLeft: 4 }} />
        </FlexWidget> : <Label text={`${deck.card_count} ${deck.card_count === 1 ? 'tarjeta' : 'tarjetas'}`} size={l.detailSize} color={colors.textMuted} style={{ width: textWidth, height: l.detailHeight, marginTop: 4 }} />}
      </FlexWidget>
      <SvgWidget svg={chevronMark} style={{ width: 16, height: 16, marginLeft: 8 }} />
    </FlexWidget>
  </FlexWidget>;
}

export function DecksWidget({ info, data }) {
  const l = decksLayout(info);
  const sections = [{ mode: 'progress', title: 'EN PROGRESO', decks: data.inProgress }, { mode: 'recent', title: 'MAZOS RECIENTES', decks: data.recent }].filter(section => section.decks.length);
  return <Shell layout={l} hero={false} accessibilityLabel="Mazos de ActiveCard: progreso de hoy y recientes. Deslizá para ver todos.">
    <Label text="Mazos" size={l.titleSize} weight={800} style={{ width: 'match_parent', height: l.headerHeight }} />
    {sections.length ? <ListWidget style={{ width: l.contentWidth, height: l.bodyHeight, marginTop: l.gap }}>
      {sections.flatMap(section => [
        <FlexWidget key={section.mode} style={{ width: l.contentWidth, height: l.sectionHeight, justifyContent: 'center' }}><Label text={section.title} size={l.compact ? 9 : 11} color={colors.textMuted} weight={700} style={{ height: l.sectionHeight, width: 'match_parent' }} /></FlexWidget>,
        ...section.decks.map(deck => <DeckRow key={`${section.mode}-${deck.id}`} deck={deck} mode={section.mode} layout={l} />),
      ])}
    </ListWidget> : <FlexWidget {...openUri('activecard:///biblioteca')} style={{ width: 'match_parent', height: l.bodyHeight, marginTop: l.gap, justifyContent: 'center' }}>
      <Label text="Tu próximo paso" size={l.nameSize} weight={700} />
      <Label text="Abrí Biblioteca para empezar" size={l.detailSize} color={colors.textMuted} fit style={{ width: 'match_parent' }} />
    </FlexWidget>}
    <FlexWidget {...openUri('activecard:///biblioteca')} accessibilityLabel="Abrir Biblioteca, todos los mazos" style={{ width: 'match_parent', height: l.footerHeight, marginTop: l.gap, flexDirection: 'row', alignItems: 'center' }}>
      <Label text="Biblioteca" size={l.compact ? 11 : 13} color={colors.accentText} style={{ width: l.contentWidth * 0.48, height: l.footerHeight }} />
      <Label text="Deslizá ↕" size={l.compact ? 10 : 12} color={colors.textMuted} style={{ width: l.contentWidth * 0.52, height: l.footerHeight, textAlign: 'right' }} />
    </FlexWidget>
  </Shell>;
}

export function CombinedWidget({ info, data }) {
  const l = combinedLayout(info);
  return <FlexWidget accessibilityLabel="ActiveCard: repaso y mazos. Deslizá los mazos para ver recientes." style={{ width: l.width, height: l.height }}>
    <ReviewWidget info={{ ...info, height: l.reviewHeight }} data={data} />
    <FlexWidget style={{ height: l.gap }} />
    <DecksWidget info={{ ...info, height: l.decksHeight }} data={data} />
  </FlexWidget>;
}

export function WidgetError({ info }) {
  const l = widgetChrome(info);
  return <Shell layout={l} accessibilityLabel="Error de lectura. Tocá para reintentar.">
    <FlexWidget style={{ height: l.height - l.padding * 2 - 30, width: 'match_parent', justifyContent: 'center' }} clickAction="REFRESH">
      <Label text="No pudimos leer tus datos" size={l.compact ? 12 : 18} weight={700} lines={2} />
      <Label text="Tocá para volver a intentar" size={l.compact ? 11 : 14} color={colors.textMuted} />
    </FlexWidget>
    <FlexWidget style={{ height: 30, justifyContent: 'center' }} clickAction="OPEN_APP"><Label text="Abrir ActiveCard →" color={colors.accentText} /></FlexWidget>
  </Shell>;
}
