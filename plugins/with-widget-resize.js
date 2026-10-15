const { withFinalizedMod, XML } = require('expo/config-plugins');
const { readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

// El plugin de widgets no expone minResize*. Aplicar después de que genere
// los proveedores; fallar si cambia el contrato, sin parchear node_modules.
const limits = { DailyReview: { width: '160dp', height: '132dp' }, StudyDecks: { width: '160dp', height: '132dp' }, ReviewAndDecks: { width: '160dp', height: '280dp' } };

async function resizeProvider(source, { width, height }) {
  const doc = await XML.parseXMLAsync(source);
  const provider = doc['appwidget-provider'];
  if (!provider?.$ || provider.$['android:resizeMode'] !== 'horizontal|vertical') {
    throw new Error('Proveedor de widget inesperado: revisar el plugin de tamaños.');
  }
  provider.$['android:minResizeWidth'] = width;
  provider.$['android:minResizeHeight'] = height;
  return XML.format(doc);
}

module.exports = function withWidgetResize(config) {
  return withFinalizedMod(config, ['android', async (mod) => {
    for (const [name, size] of Object.entries(limits)) {
      const file = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml', `widgetprovider_${name.toLowerCase()}.xml`);
      const source = await readFile(file, 'utf8');
      await writeFile(file, await resizeProvider(source, size));
    }
    return mod;
  }]);
};
module.exports.resizeProvider = resizeProvider;
