const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { applyWidgetFlame } = require('../with-widget-flame');
let root;
const native = 'android/src/main/';
const files = ['java/com/reactnativeandroidwidget/RNWidget.java', 'java/com/reactnativeandroidwidget/builder/widget/SvgWidget.java', 'res/layout/rn_widget.xml', 'res/layout-night/rn_widget.xml', 'java/com/reactnativeandroidwidget/builder/widget/TextWidget.java', 'java/com/reactnativeandroidwidget/RNWidgetJsCommunication.java'];
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'activecard-flame-'));
  fs.writeFileSync(path.join(root, 'package.json'), '{"version":"0.22.1"}');
  const installed = path.dirname(require.resolve('react-native-android-widget/package.json'));
  for (const file of files) {
    const destination = path.join(root, native, file);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(installed, native, file), destination);
  }
});
afterEach(() => {
  if (!path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(root).startsWith('activecard-flame-')) throw new Error('Destino temporal inesperado');
  fs.rmSync(root, { recursive: true, force: true });
});
test('integra overlay debajo de los toques y conserva los hooks al repetir prebuild', () => {
  applyWidgetFlame(root);
  const first = files.map(file => fs.readFileSync(path.join(root, native, file), 'utf8'));
  applyWidgetFlame(root);
  expect(files.map(file => fs.readFileSync(path.join(root, native, file), 'utf8'))).toEqual(first);
  expect(first[2].indexOf('activecard_flame_container')).toBeLessThan(first[2].indexOf('rn_widget_clickable_container'));
  expect(first[3].indexOf('activecard_flame_container')).toBeGreaterThan(0);
  expect(first[3].indexOf('activecard_flame_container')).toBeLessThan(first[3].indexOf('rn_widget_clickable_container'));
  expect(first[4]).toContain('setIncludeFontPadding(false)');
  expect(first[4]).toContain('Gravity.RIGHT | Gravity.CENTER_VERTICAL');
  expect(first[5]).toContain('"WIDGET_RESIZED".equals');
  expect(first[5]).toContain('ExistingWorkPolicy.REPLACE, builder.build()');
  expect(first[0].indexOf('isCurrentSize')).toBeLessThan(first[0].indexOf('WidgetFactory.buildWidgetFromRoot'));
  expect(fs.readdirSync(path.join(root, native, 'assets/activecard_widget_flame'))).toHaveLength(48);
});
test('un cambio nativo inesperado falla antes de sobrescribir los otros archivos', () => {
  const file = path.join(root, native, files[1]);
  const previous = fs.readFileSync(path.join(root, native, files[0]), 'utf8');
  fs.appendFileSync(file, '\n// Cambio de contrato\n');
  expect(() => applyWidgetFlame(root)).toThrow('Contrato nativo inesperado');
  expect(fs.readFileSync(path.join(root, native, files[0]), 'utf8')).toBe(previous);
});
