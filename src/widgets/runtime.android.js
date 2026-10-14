import { getWidgetInfo, requestWidgetUpdateById } from 'react-native-android-widget';
import { loadWidgetData } from './data';
import { WIDGET_NAMES } from './model';
import { DecksWidget, ReviewWidget, WidgetError } from './views.android';

function render(info, data) {
  if (!data) return <WidgetError info={info} />;
  return info.widgetName === WIDGET_NAMES.review ? <ReviewWidget info={info} data={data} /> : <DecksWidget info={info} data={data} />;
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }) {
  if (!Object.values(WIDGET_NAMES).includes(widgetInfo.widgetName) || widgetAction === 'WIDGET_DELETED') return;
  if (widgetAction === 'WIDGET_CLICK' && clickAction !== 'REFRESH') return;
  let data;
  try { data = await loadWidgetData(); } catch {
    // Un fallo de SQLite nunca se presenta como cero pendientes o una biblioteca vacía.
    console.warn('No se pudieron leer los datos del widget de ActiveCard.');
  }
  renderWidget(render(widgetInfo, data));
}

export async function refreshInstalledWidgets() {
  const groups = await Promise.all(Object.values(WIDGET_NAMES).map(getWidgetInfo));
  const widgets = groups.flat();
  if (!widgets.length) return;
  let data;
  try { data = await loadWidgetData(); } catch {
    console.warn('No se pudieron leer los datos de los widgets de ActiveCard.');
  }
  // La API por ID espera el callback; requestWidgetUpdate usa forEach(async)
  // y no propaga errores del render. Acá cada instancia y tamaño quedan atendidos.
  for (const info of widgets) {
    await requestWidgetUpdateById({ widgetName: info.widgetName, widgetId: info.widgetId, renderWidget: (current) => render(current, data) });
  }
}
