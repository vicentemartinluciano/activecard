import { getWidgetInfo, requestWidgetUpdateById } from 'react-native-android-widget';
import { loadWidgetData } from './data';
import { WIDGET_NAMES } from './model';
import { CombinedWidget, DecksWidget, ReviewWidget, WidgetError } from './views.android';

const pending = new Map();
function render(info, data) {
  if (!data) return <WidgetError info={info} />;
  if (info.widgetName === WIDGET_NAMES.review) return <ReviewWidget info={info} data={data} />;
  if (info.widgetName === WIDGET_NAMES.combined) return <CombinedWidget info={info} data={data} />;
  return <DecksWidget info={info} data={data} />;
}

export async function widgetTaskHandler({ widgetInfo, widgetAction, clickAction, renderWidget }) {
  if (!Object.values(WIDGET_NAMES).includes(widgetInfo.widgetName)) return;
  if (widgetAction === 'WIDGET_DELETED') { pending.delete(widgetInfo.widgetId); return; }
  if (widgetAction === 'WIDGET_CLICK' && clickAction !== 'REFRESH') return;
  const token = {};
  pending.set(widgetInfo.widgetId, token);
  try {
    if (widgetAction === 'WIDGET_RESIZED') {
      // Agrupar el arrastre dentro de la tarea headless, sin demorar WorkManager
      // ni perder su prioridad expedited al enviar el tamaño definitivo.
      await new Promise(resolve => setTimeout(resolve, 150));
      if (pending.get(widgetInfo.widgetId) !== token) return;
    }
    let data;
    try { data = await loadWidgetData(); } catch {
      // Un fallo de SQLite nunca se presenta como cero pendientes o una biblioteca vacía.
      console.warn('No se pudieron leer los datos del widget de ActiveCard.');
    }
    if (pending.get(widgetInfo.widgetId) !== token) return;
    // Android puede haber cambiado otra vez de tamaño mientras SQLite leía.
    const current = (await getWidgetInfo(widgetInfo.widgetName)).find(info => info.widgetId === widgetInfo.widgetId);
    if (current && pending.get(widgetInfo.widgetId) === token) renderWidget(render(current, data));
  } finally {
    if (pending.get(widgetInfo.widgetId) === token) pending.delete(widgetInfo.widgetId);
  }
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
