const { resizeProvider } = require('../with-widget-resize');
const { XML } = require('expo/config-plugins');

test('agrega mínimos de resize independientes sin perder recursos ni duplicar atributos', async () => {
  const source = '<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android" android:minWidth="250dp" android:minHeight="220dp" android:resizeMode="horizontal|vertical" android:previewImage="@drawable/studydecks_preview" android:targetCellHeight="3" />';
  const size = { width: '160dp', height: '132dp' };
  const first = await resizeProvider(source, size);
  expect(await resizeProvider(first, size)).toBe(first);
  const attributes = (await XML.parseXMLAsync(first))['appwidget-provider'].$;
  expect(attributes).toMatchObject({ 'android:minResizeWidth': '160dp', 'android:minResizeHeight': '132dp', 'android:minWidth': '250dp', 'android:previewImage': '@drawable/studydecks_preview', 'android:targetCellHeight': '3' });
});
test('no oculta cambios de contrato del proveedor', async () => {
  await expect(resizeProvider('<resources/>', { width: '180dp', height: '132dp' })).rejects.toThrow('Proveedor de widget inesperado');
});
