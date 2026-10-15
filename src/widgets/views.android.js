import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { cardsMark, chevronMark, widgetBackdrop } from './art';
import { decksLayout, reviewLayout, widgetChrome } from './layout';
import { widgetDeckUri } from './model';

const palette = { text: '#F4F6FF', muted: '#A6B2D0', blue: '#A6BBFF', green: '#65D9A5' };
const family = { 400: 'PlusJakartaSans_400Regular', 600: 'PlusJakartaSans_600SemiBold', 700: 'PlusJakartaSans_700Bold', 800: 'PlusJakartaSans_800ExtraBold' };
const openUri = (uri) => ({ clickAction: 'OPEN_URI', clickActionData: { uri } });
function Label({ text, size = 16, weight = 600, color = palette.text, lines = 1, fit = false, style = {} }) {
  return <TextWidget text={String(text)} maxLines={lines} truncate="END" style={{ fontFamily: family[weight], fontWeight: String(weight), fontSize: size, color, adjustsFontSizeToFit: fit, ...style }} />;
}

function Shell({ layout: l, title, accessibilityLabel, children }) {
  return <OverlapWidget accessibilityLabel={accessibilityLabel} style={{ width: l.width, height: l.height, borderRadius: 24, overflow: 'hidden' }}>
    <SvgWidget svg={widgetBackdrop(l.width, l.height)} style={{ width: l.width, height: l.height }} />
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', padding: l.padding }}>
      <FlexWidget style={{ width: 'match_parent', height: l.headerHeight, flexDirection: 'row', alignItems: 'center', marginBottom: l.headerGap }}>
        <SvgWidget svg={cardsMark} style={{ width: l.iconSize, height: l.iconSize, marginRight: 8 }} clickAction="OPEN_APP" accessibilityLabel="Abrir ActiveCard" />
        <FlexWidget style={{ flex: 1, width: 0, height: l.headerHeight, justifyContent: 'center' }}>
          <Label text={title} size={l.titleSize} weight={700} fit style={{ width: 'match_parent', height: l.headerHeight }} />
        </FlexWidget>
        <FlexWidget clickAction="REFRESH" accessibilityLabel="Actualizar widget" style={{ width: l.headerHeight, height: l.headerHeight, alignItems: 'center', justifyContent: 'center', marginLeft: 6, backgroundColor: '#FFFFFF0C', borderRadius: 12 }}>
          <Label text="↻" size={l.compact ? 22 : 28} color={palette.blue} />
        </FlexWidget>
      </FlexWidget>
      {children}
    </FlexWidget>
  </OverlapWidget>;
}

function Bar({ pct, width, height = 8 }) {
  const value = Math.max(0, Math.min(100, pct));
  return <OverlapWidget style={{ width, height, borderRadius: height, backgroundColor: '#FFFFFF14', overflow: 'hidden' }}>
    {value > 0 && <FlexWidget style={{ width: Math.max(height, Math.round(width * value / 100)), height, borderRadius: height, backgroundGradient: { from: '#3E63DD', to: '#65D9A5', orientation: 'LEFT_RIGHT' } }} />}
  </OverlapWidget>;
}

export function ReviewWidget({ info, data }) {
  const stats = data.review;
  const done = stats.remaining === 0 && stats.total > 0;
  const clear = stats.remaining === 0;
  const l = reviewLayout(info);
  const summary = done ? 'Repaso completado ✓' : clear ? 'No hay tarjetas pendientes'
    : `${stats.done} ${stats.done === 1 ? 'completada' : 'completadas'} · ${stats.pct}%`;
  return <Shell layout={l} title="Repaso diario" accessibilityLabel={`Repaso diario: ${stats.remaining} pendientes. ${summary}`}>
    <FlexWidget style={{ height: l.bodyHeight, width: 'match_parent' }} {...openUri('activecard:///repaso')} accessibilityLabel="Abrir repaso diario">
      <FlexWidget style={{ height: l.heroHeight, width: 'match_parent', flexDirection: 'row', alignItems: 'center' }}>
        <Label text={clear ? 'Al día' : stats.remaining} size={l.heroSize} weight={800} fit color={clear ? palette.green : palette.text}
          style={{ width: clear ? 'match_parent' : Math.round(l.contentWidth * 0.54), height: l.heroHeight }} />
        {!clear && <FlexWidget style={{ flex: 1, width: 0, justifyContent: 'center' }}>
          <Label text={stats.remaining === 1 ? 'pendiente' : 'pendientes'} size={l.pendingSize} fit style={{ width: 'match_parent', height: Math.ceil(l.pendingSize * 1.5) }} color={palette.muted} />
        </FlexWidget>}
      </FlexWidget>
      <Label text={summary} size={l.statSize} color={palette.muted} style={{ height: l.statHeight, width: 'match_parent', marginTop: l.gap, marginBottom: l.gap }} />
      <Bar pct={done ? 100 : stats.pct} width={l.contentWidth} height={l.barHeight} />
    </FlexWidget>
    <FlexWidget style={{ width: 'match_parent', height: l.buttonHeight, marginTop: l.footerGap, paddingHorizontal: l.compact ? 10 : 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', backgroundGradient: { from: '#466DEA', to: '#2E49A7', orientation: 'TL_BR' } }} {...openUri('activecard:///repaso')} accessibilityLabel={clear ? 'Abrir repaso' : 'Repasar ahora'}>
      <FlexWidget style={{ flex: 1, width: 0 }}><Label text={clear ? 'Abrir repaso' : 'Repasar ahora'} size={l.buttonSize} weight={700} style={{ width: 'match_parent' }} /></FlexWidget>
      <Label text="→" size={l.compact ? 22 : 28} />
    </FlexWidget>
  </Shell>;
}

function DeckRow({ deck, mode, layout: l }) {
  const progress = mode === 'progress';
  const textWidth = l.contentWidth - 26;
  const percentWidth = Math.ceil(l.detailSize * 3.8);
  return <FlexWidget {...openUri(widgetDeckUri(deck.id, mode))} accessibilityLabel={`${progress ? 'Continuar' : 'Abrir'} ${deck.name}`} style={{ width: 'match_parent', height: l.rowHeight, flexDirection: 'row', alignItems: 'center' }}>
    <FlexWidget style={{ width: textWidth }}>
      <Label text={deck.name} size={l.nameSize} weight={700} lines={l.lines} style={{ width: 'match_parent', height: l.nameHeight }} />
      {progress ? <FlexWidget style={{ width: 'match_parent', height: l.detailHeight, flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
        <Bar pct={deck.progress.pct} width={Math.max(20, textWidth - percentWidth - 8)} height={l.compact ? 5 : 7} />
        <Label text={`${deck.progress.pct}%`} size={l.detailSize} color={palette.green} style={{ width: percentWidth, height: l.detailHeight, textAlign: 'right', marginLeft: 8 }} />
      </FlexWidget> : <Label text={`${deck.card_count} ${deck.card_count === 1 ? 'tarjeta' : 'tarjetas'}`} size={l.detailSize} color={palette.muted} style={{ height: l.detailHeight, marginTop: 4, width: 'match_parent' }} />}
    </FlexWidget>
    <SvgWidget svg={chevronMark} style={{ width: 20, height: 20, marginLeft: 6 }} />
  </FlexWidget>;
}

export function DecksWidget({ info, data }) {
  const l = decksLayout(info, data);
  return <Shell layout={l} title={l.title} accessibilityLabel="Mazos de ActiveCard: progreso de hoy y recientes">
    <FlexWidget style={{ width: 'match_parent', height: l.bodyHeight }}>
      {l.sections.length === 0 ? <FlexWidget {...openUri('activecard:///biblioteca')} style={{ height: l.bodyHeight, justifyContent: 'center' }}>
        <Label text="Tu próximo paso" size={l.nameSize} weight={700} />
        <Label text="Abrí Biblioteca para empezar" size={l.detailSize} color={palette.muted} style={{ marginTop: 6 }} />
      </FlexWidget> : l.sections.map((section, index) => <FlexWidget key={section.mode} style={{ width: 'match_parent' }}>
        {index > 0 && <FlexWidget style={{ width: 'match_parent', height: l.sectionHeight, justifyContent: 'center' }}>
          <Label text="RECIENTES" size={l.compact ? 11 : 13} color={palette.blue} weight={700} />
        </FlexWidget>}
        {section.decks.map((deck) => <DeckRow key={deck.id} deck={deck} mode={section.mode} layout={l} />)}
      </FlexWidget>)}
    </FlexWidget>
    <FlexWidget {...openUri('activecard:///biblioteca')} accessibilityLabel="Abrir Biblioteca, todos los mazos" style={{ width: 'match_parent', height: l.footerHeight, marginTop: l.footerGap, flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget style={{ flex: 1, width: 0 }}><Label text="Biblioteca" size={l.compact ? 12 : 15} color={palette.blue} /></FlexWidget>
      <Label text={l.hidden > 0 ? `+${l.hidden} más` : 'Ver todos →'} size={l.compact ? 11 : 14} color={palette.muted} />
    </FlexWidget>
  </Shell>;
}

export function WidgetError({ info }) {
  const l = widgetChrome(info);
  return <Shell layout={l} title="ActiveCard" accessibilityLabel="Error de lectura. Tocá para reintentar.">
    <FlexWidget style={{ width: 'match_parent', flex: 1, height: 0, justifyContent: 'center' }} clickAction="REFRESH">
      <Label text="No pudimos leer tus datos" size={l.compact ? 14 : 18} weight={700} />
      <Label text="Tocá para volver a intentar" size={l.compact ? 12 : 16} color={palette.muted} style={{ marginTop: 8 }} />
    </FlexWidget>
    <FlexWidget style={{ height: 36, justifyContent: 'center' }} clickAction="OPEN_APP"><Label text="Abrir ActiveCard →" color={palette.blue} /></FlexWidget>
  </Shell>;
}
