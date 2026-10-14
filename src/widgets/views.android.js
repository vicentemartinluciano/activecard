import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import { cardsMark, chevronMark, widgetBackdrop } from './art';
import { widgetDeckUri, widgetRowCount } from './model';

const palette = { text: '#F4F6FF', muted: '#A6B2D0', blue: '#A6BBFF', green: '#65D9A5' };
const family = { 400: 'PlusJakartaSans_400Regular', 600: 'PlusJakartaSans_600SemiBold', 700: 'PlusJakartaSans_700Bold', 800: 'PlusJakartaSans_800ExtraBold' };
const openUri = (uri) => ({ clickAction: 'OPEN_URI', clickActionData: { uri } });
function Label({ text, size = 12, weight = 600, color = palette.text, style = {} }) {
  return <TextWidget text={String(text)} maxLines={1} truncate="END" style={{ fontFamily: family[weight], fontWeight: String(weight), fontSize: size, color, ...style }} />;
}

function Shell({ info, title, children }) {
  const { width, height } = info;
  const padding = width < 240 || height < 190 ? 12 : 16;
  return <OverlapWidget style={{ width, height, borderRadius: 24, overflow: 'hidden' }}>
    <SvgWidget svg={widgetBackdrop(width, height)} style={{ width, height }} />
    <FlexWidget style={{ width: 'match_parent', height: 'match_parent', padding }}>
      <FlexWidget style={{ width: 'match_parent', height: 30, flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <SvgWidget svg={cardsMark} style={{ width: 28, height: 28, marginRight: 8 }} clickAction="OPEN_APP" />
        <FlexWidget style={{ flex: 1, width: 0, height: 30, justifyContent: 'center' }}><Label text={title} size={width < 240 ? 12 : 14} weight={700} style={{ width: 'match_parent' }} /></FlexWidget>
        <FlexWidget clickAction="REFRESH" style={{ width: 32, height: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF0C', borderRadius: 10 }}>
          <Label text="↻" size={21} color={palette.blue} />
        </FlexWidget>
      </FlexWidget>
      {children}
    </FlexWidget>
  </OverlapWidget>;
}

function Bar({ pct, width, height = 5 }) {
  const value = Math.max(0, Math.min(100, pct));
  return <OverlapWidget style={{ width, height, borderRadius: height, backgroundColor: '#FFFFFF14', overflow: 'hidden' }}>
    {value > 0 && <FlexWidget style={{ width: Math.max(height, Math.round(width * value / 100)), height, borderRadius: height, backgroundGradient: { from: '#3E63DD', to: '#65D9A5', orientation: 'LEFT_RIGHT' } }} />}
  </OverlapWidget>;
}

export function ReviewWidget({ info, data }) {
  const stats = data.review;
  const done = stats.remaining === 0 && stats.total > 0;
  const clear = stats.remaining === 0;
  const compact = info.height < 190;
  const tight = info.height < 170;
  const width = info.width - (info.width < 240 || compact ? 24 : 32);
  return <Shell info={info} title="Repaso diario">
    <FlexWidget style={{ flex: 1, height: 0, justifyContent: 'center', width: 'match_parent' }} {...openUri('activecard:///repaso')}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', ...(tight ? { height: 32 } : {}) }}>
        <Label text={clear ? 'Al día' : stats.remaining} size={tight ? 26 : compact ? 30 : 42} weight={800} color={clear ? palette.green : palette.text} />
        {!clear && <Label text="pendientes" size={12} color={palette.muted} style={{ marginLeft: 8 }} />}
      </FlexWidget>
      <Label text={done ? 'Repaso completado ✓' : clear ? 'No hay tarjetas pendientes' : `${stats.done} completadas · ${stats.pct}%`} size={11} color={palette.muted} style={{ marginBottom: tight ? 2 : compact ? 6 : 10, ...(tight ? { height: 16 } : {}) }} />
      <Bar pct={done ? 100 : stats.pct} width={width} height={tight ? 4 : 5} />
    </FlexWidget>
    <FlexWidget style={{ width: 'match_parent', height: compact ? 32 : 38, marginTop: 8, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundGradient: { from: '#466DEA', to: '#2E49A7', orientation: 'TL_BR' } }} {...openUri('activecard:///repaso')}>
      <Label text={clear ? 'Abrir repaso' : 'Repasar ahora'} size={12} weight={700} />
      <Label text="→" size={18} />
    </FlexWidget>
  </Shell>;
}

export function DecksWidget({ info, data }) {
  const progress = data.mode === 'progress';
  const visible = data.decks.slice(0, widgetRowCount(info.height));
  const padding = info.width < 240 || info.height < 190 ? 12 : 16;
  const contentWidth = info.width - padding * 2;
  const rowWidth = contentWidth - 22;
  return <Shell info={info} title={progress ? 'Mazos en progreso' : 'Mazos recientes'}>
    <FlexWidget style={{ width: 'match_parent', flex: 1, height: 0, justifyContent: 'center' }}>
      {visible.length === 0 ? <FlexWidget {...openUri('activecard:///biblioteca')} style={{ height: 62, justifyContent: 'center' }}>
        <Label text="Tu próximo paso" size={16} weight={700} />
        <Label text="Abrí Biblioteca para empezar" size={11} color={palette.muted} style={{ marginTop: 6 }} />
      </FlexWidget> : visible.map((deck) => <FlexWidget key={deck.id} {...openUri(widgetDeckUri(deck.id, data.mode))} style={{ width: 'match_parent', height: 56, flexDirection: 'row', alignItems: 'center' }}>
        <FlexWidget style={{ width: rowWidth }}>
          <Label text={deck.name} size={13} weight={700} style={{ width: 'match_parent' }} />
          {progress ? <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', marginTop: 7 }}>
            <Bar pct={deck.progress.pct} width={Math.max(40, rowWidth - 42)} height={4} />
            <Label text={`${deck.progress.pct}%`} size={10} color={palette.green} style={{ marginLeft: 8 }} />
          </FlexWidget> : <Label text={`${deck.card_count} ${deck.card_count === 1 ? 'tarjeta' : 'tarjetas'}`} size={11} color={palette.muted} style={{ marginTop: 4 }} />}
        </FlexWidget>
        <SvgWidget svg={chevronMark} style={{ width: 16, height: 16, marginLeft: 6 }} />
      </FlexWidget>)}
    </FlexWidget>
    <FlexWidget {...openUri('activecard:///biblioteca')} style={{ width: 'match_parent', height: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Label text="Biblioteca" size={11} color={palette.blue} />
      <Label text={progress ? 'AVANCE DE HOY' : 'ÚLTIMO ESTUDIO'} size={8} color={palette.muted} />
    </FlexWidget>
  </Shell>;
}

export function WidgetError({ info }) {
  return <Shell info={info} title="ActiveCard">
    <FlexWidget style={{ width: 'match_parent', flex: 1, height: 0, justifyContent: 'center' }} clickAction="REFRESH">
      <Label text="No pudimos leer tus datos" size={13} weight={700} />
      <Label text="Tocá para volver a intentar" size={11} color={palette.muted} style={{ marginTop: 8 }} />
    </FlexWidget>
    <FlexWidget style={{ height: 30, justifyContent: 'center' }} clickAction="OPEN_APP"><Label text="Abrir ActiveCard →" color={palette.blue} /></FlexWidget>
  </Shell>;
}
