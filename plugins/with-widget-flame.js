/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { withDangerousMod } = require('expo/config-plugins');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const changes = [
  { file: 'java/com/reactnativeandroidwidget/RNWidgetJsCommunication.java', hash: 'dda6c0720d639f952423fb84de78ce5b1b9f789ca0a8358d7bed1723547cfdb5',
    from: '        WorkManager\n            .getInstance(context)\n            .enqueue(builder.build());',
    to: '        if ("WIDGET_RESIZED".equals(data.getString("widgetAction"))) {\n            WorkManager.getInstance(context).enqueueUniqueWork(\n                context.getPackageName() + ".ACTIVE_CARD_RESIZE." + data.getInt("widgetId", -1),\n                ExistingWorkPolicy.REPLACE, builder.build());\n        } else {\n            WorkManager.getInstance(context).enqueue(builder.build());\n        }' },
  { file: 'java/com/reactnativeandroidwidget/RNWidget.java', hash: '14047f44da2b0534f8d06384d65ceabf5abc6afe25c6529df75b40814f7b273b',
    extras: [
      { from: '        ReadableMap light = config.getMap("light");', to: '        ReadableMap light = config.getMap("light");\n        if (!ActiveCardWidgetFlame.isCurrentSize(appContext, widgetId, light)) return;' },
      { from: '        AppWidgetManager.getInstance(appContext)\n            .updateAppWidget(widgetId, remoteWidgetView);', to: '        if (!ActiveCardWidgetFlame.isCurrentSize(appContext, widgetId, light)) return;\n        AppWidgetManager.getInstance(appContext)\n            .updateAppWidget(widgetId, remoteWidgetView);' },
    ],
    from: '        addCollectionViews(widgetId, remoteWidgetView, widgetWithViews);',
    to: '        ActiveCardWidgetFlame.apply(appContext, widgetId, remoteWidgetView, widgetWithViews.getRootView());\n        addCollectionViews(widgetId, remoteWidgetView, widgetWithViews);' },
  { file: 'java/com/reactnativeandroidwidget/builder/widget/SvgWidget.java', hash: 'b70fef5e16385a27910a9028667bf936f1cb74920b5a4b42d1408dd43251f879',
    from: '            view.setImageDrawable(pd);',
    previous: '            view.setImageDrawable(pd);\n            if (props.hasKey("svgString") && props.getString("svgString").contains("data-activecard-flame=\\"active\\"")) view.setTag("activecard-flame:" + props.getString("svgString"));',
    to: '            view.setImageDrawable(pd);\n            if (props.hasKey("svgString")) com.reactnativeandroidwidget.ActiveCardWidgetFlame.tag(view, props.getString("svgString"));' },
  { file: 'res/layout/rn_widget.xml', hash: '2a7a5628df8a84f9686e5356dd1e8fe1bb6892f4865a28336e5f6ee0ef40d2fd',
    from: '    <FrameLayout\n        android:id="@+id/rn_widget_clickable_container"',
    to: '    <FrameLayout android:id="@+id/activecard_flame_container" android:layout_width="match_parent" android:layout_height="match_parent" android:visibility="gone" />\n\n    <FrameLayout\n        android:id="@+id/rn_widget_clickable_container"' },
  { file: 'res/layout-night/rn_widget.xml', hash: 'b5b83c9ac5c0a75a4509d834a7f34c57639bbfbe0e1475fb701378cbab42e6ba',
    from: '    <FrameLayout\n        android:id="@+id/rn_widget_clickable_container"',
    to: '    <FrameLayout android:id="@+id/activecard_flame_container" android:layout_width="match_parent" android:layout_height="match_parent" android:visibility="gone" />\n\n    <FrameLayout\n        android:id="@+id/rn_widget_clickable_container"' },
  { file: 'java/com/reactnativeandroidwidget/builder/widget/TextWidget.java', hash: '5ed592b33e786514ca73fa96122e466b5b12fa612370c5a4f7a0e24fe59f1c47',
    from: '        if (props.hasKey("textAlign")) {\n            if ("left".equals(props.getString("textAlign"))) {\n                view.setGravity(Gravity.LEFT);\n            } else if ("right".equals(props.getString("textAlign"))) {\n                view.setGravity(Gravity.RIGHT);\n            } else {\n                view.setGravity(Gravity.CENTER);\n            }\n        }',
    to: '        view.setIncludeFontPadding(false);\n        view.setGravity(Gravity.CENTER_VERTICAL | Gravity.LEFT);\n        if (props.hasKey("textAlign")) {\n            if ("left".equals(props.getString("textAlign"))) {\n                view.setGravity(Gravity.LEFT | Gravity.CENTER_VERTICAL);\n            } else if ("right".equals(props.getString("textAlign"))) {\n                view.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);\n            } else {\n                view.setGravity(Gravity.CENTER);\n            }\n        }' },
];
function applyWidgetFlame(packageRoot) {
  if (JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')).version !== '0.22.1') throw new Error('Revisar integración de fuego al actualizar widgets.');
  const base = path.join(packageRoot, 'android/src/main');
  const writes = changes.map(({ file, hash, from, to, previous, extras = [] }) => {
    const target = path.join(base, file);
    let content = fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
    for (const edit of extras) content = content.replace(edit.to, edit.from);
    const original = content.includes(to) ? content.replace(to, from) : previous && content.includes(previous) ? content.replace(previous, from) : content;
    if (digest(original) !== hash || original.split(from).length !== 2) throw new Error(`Contrato nativo inesperado: ${file}`);
    let patched = original.replace(from, to);
    for (const edit of extras) {
      if (patched.split(edit.from).length !== 2) throw new Error(`Contrato nativo inesperado: ${file}`);
      patched = patched.replace(edit.from, edit.to);
    }
    return { target, content: patched };
  });
  for (const [source, destination] of [['ActiveCardWidgetFlame.java', 'java/com/reactnativeandroidwidget/ActiveCardWidgetFlame.java'], ['activecard_flame.xml', 'res/layout/activecard_flame.xml'], ['activecard_flame_frame.xml', 'res/layout/activecard_flame_frame.xml']]) writes.push({ target: path.join(base, destination), content: fs.readFileSync(path.join(__dirname, 'widget-flame', source), 'utf8') });
  for (const write of writes) fs.writeFileSync(write.target, write.content);
  const assets = path.join(base, 'assets/activecard_widget_flame');
  fs.mkdirSync(assets, { recursive: true });
  for (let i = 0; i < 48; i++) fs.copyFileSync(path.join(__dirname, `../assets/widgets/flame/frame-${i}.png`), path.join(assets, `frame-${i}.png`));
}
module.exports = (config) => withDangerousMod(config, ['android', async (mod) => {
  applyWidgetFlame(path.dirname(require.resolve('react-native-android-widget/package.json', { paths: [mod.modRequest.projectRoot] })));
  return mod;
}]);
module.exports.applyWidgetFlame = applyWidgetFlame;
