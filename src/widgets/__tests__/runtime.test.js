import { getWidgetInfo, requestWidgetUpdateById } from 'react-native-android-widget';
import { buildWidgetTree } from 'react-native-android-widget/src/api/build-widget-tree';
import { loadWidgetData } from '../data';
import { refreshInstalledWidgets, widgetTaskHandler } from '../runtime.android';

jest.mock('../data', () => ({ loadWidgetData: jest.fn() }));
jest.mock('react-native-android-widget', () => ({ ...jest.requireActual('react-native-android-widget'), getWidgetInfo: jest.fn(), requestWidgetUpdateById: jest.fn() }));
const info = (name, width = 320, height = 260, id = 1) => ({ widgetName: name, widgetId: id, width, height });
const data = { review: { done: 2, remaining: 8, total: 10, pct: 20 }, recent: [{ id: 4, name: 'Reciente adicional', card_count: 15 }], inProgress: [{ id: 1, name: 'Operaciones', progress: { pct: 30 } }, { id: 2, name: 'Economía', progress: { pct: 60 } }, { id: 3, name: 'Personas', progress: { pct: 80 } }] };
const render = async (name, width, height) => {
  const renderWidget = jest.fn();
  getWidgetInfo.mockResolvedValue([info(name, width, height)]);
  await widgetTaskHandler({ widgetInfo: info(name, width, height), widgetAction: 'WIDGET_ADDED', renderWidget });
  return JSON.stringify(buildWidgetTree(renderWidget.mock.calls[0][0]));
};
beforeEach(() => {
  jest.clearAllMocks();
  loadWidgetData.mockResolvedValue(data);
  getWidgetInfo.mockResolvedValue([]);
});
test('construye árboles nativos para repaso compacto/amplio y enlaces explícitos', async () => {
  for (const [width, height] of [[180, 154], [320, 180], [400, 300]]) {
    const tree = await render('DailyReview', width, height);
    expect(tree).toContain('Repasar ahora');
    expect(tree).toContain('activecard:///repaso');
    expect(tree).not.toContain('REFRESH');
    const labels = [];
    const walk = (node) => { if (node.type === 'TextWidget') labels.push(node.props.text); (node.children || []).forEach(walk); };
    walk(JSON.parse(tree));
    expect(labels).not.toContain('Repaso diario');
    expect(tree).toContain('Racha de');
  }
});
test('redimensionar agrega recientes con su enlace y conserva Biblioteca', async () => {
  const small = await render('StudyDecks', 180, 154);
  expect(small).toContain('Operaciones'); expect(small).toContain('Economía');
  expect(small).toContain('Reciente adicional'); expect(small).toContain('ListWidget');
  expect(small).toContain('activecard:///biblioteca');
  expect(small).toContain('target=study');
  const large = await render('StudyDecks', 320, 340);
  expect(large).toContain('MAZOS RECIENTES');
  expect(large).toContain('Reciente adicional');
  expect(large).toContain('target=deck');
});
test('completado, recientes y biblioteca vacía tienen estados propios', async () => {
  loadWidgetData.mockResolvedValue({ ...data, review: { done: 10, remaining: 0, total: 10, pct: 100 } });
  expect(await render('DailyReview', 320, 180)).toContain('REPASAR DE NUEVO');
  loadWidgetData.mockResolvedValue({ ...data, inProgress: [], recent: [{ id: 2, name: 'Economía', card_count: 1 }] });
  const recent = await render('StudyDecks', 320, 260);
  expect(recent).toContain('MAZOS RECIENTES'); expect(recent).toContain('target=deck');
  loadWidgetData.mockResolvedValue({ ...data, inProgress: [], recent: [] });
  expect(await render('StudyDecks', 320, 260)).toContain('Tu próximo paso');
});
test('fallo de lectura muestra reintento y nunca un progreso ficticio', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  loadWidgetData.mockRejectedValue(new Error('SQLite busy'));
  const tree = await render('DailyReview', 320, 180);
  expect(tree).toContain('No pudimos leer tus datos'); expect(tree).not.toContain('Al día');
  warn.mockRestore();
});
test('eliminación e interacción desconocida no abren la base', async () => {
  const renderWidget = jest.fn();
  await widgetTaskHandler({ widgetInfo: info('DailyReview'), widgetAction: 'WIDGET_DELETED', renderWidget });
  await widgetTaskHandler({ widgetInfo: info('DailyReview'), widgetAction: 'WIDGET_CLICK', clickAction: 'OTHER', renderWidget });
  expect(loadWidgetData).not.toHaveBeenCalled(); expect(renderWidget).not.toHaveBeenCalled();
});
test('refresca todas las instancias con su tamaño y evita leer SQLite si no hay widgets', async () => {
  await refreshInstalledWidgets();
  expect(loadWidgetData).not.toHaveBeenCalled();
  const instances = [info('DailyReview', 180, 154, 1), info('DailyReview', 320, 240, 2), info('StudyDecks', 320, 260, 3), info('ReviewAndDecks', 320, 340, 4)];
  getWidgetInfo.mockImplementation(async (name) => instances.filter((widget) => widget.widgetName === name));
  requestWidgetUpdateById.mockImplementation(async (props) => buildWidgetTree(await props.renderWidget(instances.find((widget) => widget.widgetId === props.widgetId))));
  await refreshInstalledWidgets();
  expect(loadWidgetData).toHaveBeenCalledTimes(1);
  expect(requestWidgetUpdateById.mock.calls.map(([props]) => props.widgetId)).toEqual([1, 2, 3, 4]);
});

test('el combinado mantiene repaso y colección de todos los mazos con sus enlaces', async () => {
  const tree = await render('ReviewAndDecks', 401, 340);
  expect(tree).toContain('Repaso de hoy');
  expect(tree).toContain('ListWidget');
  expect(tree).toContain('Reciente adicional');
  expect(tree).toContain('activecard-progress');
  expect(tree).toContain('activecard:///repaso');
  expect(tree).toContain('target=study');
  expect(tree).toContain('target=deck');
});

test('racha activa usa la marca animada; sin actividad hoy queda quieta y conserva los días', async () => {
  loadWidgetData.mockResolvedValue({ ...data, streak: { days: 7, activeToday: true } });
  expect(await render('DailyReview', 320, 340)).toContain('activecard-flame');
  const active = await render('DailyReview', 320, 340);
  expect(active).toContain('7 días');
  loadWidgetData.mockResolvedValue({ ...data, streak: { days: 7, activeToday: false } });
  const idle = await render('DailyReview', 320, 340);
  expect(idle).toContain('7 días');
  expect(idle).not.toEqual(active);
});

test('Mazos destina toda su superficie interior a la lista y Biblioteca se desplaza con ella', async () => {
  const tree = JSON.parse(await render('StudyDecks', 294, 218));
  const labels = [];
  let list;
  const walk = node => {
    if (node.type === 'TextWidget') labels.push(node.props.text);
    if (node.type === 'ListWidget') list = node;
    (node.children || []).forEach(walk);
  };
  walk(tree);
  expect(labels).not.toContain('Mazos');
  expect(labels.some(text => text.includes('Deslizá'))).toBe(false);
  expect(list.props.height).toBe(192);
  expect(JSON.stringify(list.children.at(-1))).toContain('activecard:///biblioteca');
});

test('una ráfaga de resize sólo lee y dibuja la última instancia, con las medidas vigentes', async () => {
  jest.useFakeTimers();
  try {
    const renderWidget = jest.fn();
    getWidgetInfo.mockResolvedValue([info('DailyReview', 401, 340)]);
    const tasks = [218, 240, 280].map(height => widgetTaskHandler({ widgetInfo: info('DailyReview', 294, height), widgetAction: 'WIDGET_RESIZED', renderWidget }));
    expect(loadWidgetData).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(150);
    await Promise.all(tasks);
    expect(loadWidgetData).toHaveBeenCalledTimes(1);
    expect(renderWidget).toHaveBeenCalledTimes(1);
    const tree = buildWidgetTree(renderWidget.mock.calls[0][0]);
    expect(tree.props).toMatchObject({ width: 401, height: 340 });
  } finally { jest.useRealTimers(); }
});

test('una lectura vieja no reemplaza el resultado de una tarea más nueva', async () => {
  let finishOld;
  loadWidgetData.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  getWidgetInfo.mockResolvedValue([info('DailyReview', 401, 340)]);
  const oldRender = jest.fn();
  const newRender = jest.fn();
  const older = widgetTaskHandler({ widgetInfo: info('DailyReview', 294, 218), widgetAction: 'WIDGET_UPDATE', renderWidget: oldRender });
  await widgetTaskHandler({ widgetInfo: info('DailyReview', 401, 340), widgetAction: 'WIDGET_UPDATE', renderWidget: newRender });
  finishOld(data);
  await older;
  expect(newRender).toHaveBeenCalledTimes(1);
  expect(oldRender).not.toHaveBeenCalled();
});
