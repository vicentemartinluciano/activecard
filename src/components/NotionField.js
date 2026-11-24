// Editor estilo Notion — versión NATIVA: TipTap corriendo dentro de un
// WebView, con el bundle embebido (assets/editor/editorHtml.js, generado por
// `npm run editor:build`) → abre sin conexión y viaja por OTA.
// La versión web vive en NotionField.web.js (ahí TipTap corre directo sobre
// react-dom, sin WebView; Metro resuelve por extensión de plataforma).
//
// API (idéntica en ambas plataformas): value/onChangeText SIEMPRE hablan
// MARCAS (el formato de richtext.js). richhtml.js convierte en el borde.

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import editorHtml from "../../assets/editor/editorHtml";
import { htmlToMarks, marksToHtml } from "../lib/richhtml";
import { sanitizeLinkUrl } from "../lib/richLink";
import { colors, radius } from "../theme";

let sharedCopiedFormat = null;
const mountedInjectors = new Set();

export default function NotionField({
  value,
  onChangeText,
  placeholder,
  minHeight = 110,
  defaultAlign = "left",
  page = false,
  editorActionsRef = null,
}) {
  const webRef = useRef(null);
  const [height, setHeight] = useState(minHeight);
  const [ready, setReady] = useState(false);
  // Últimas marcas que emitió el editor: si el value que baja es ese mismo
  // eco, NO hay que re-inyectar (perdería el cursor mientras se escribe).
  const lastEmitted = useRef(null);

  const inject = useCallback((js) => {
    webRef.current?.injectJavaScript(`${js}; true;`);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (value === lastEmitted.current) return;
    inject(`window.__editor.setContent(${JSON.stringify(marksToHtml(value))})`);
  }, [value, ready, inject]);

  useEffect(() => {
    if (!ready) return undefined;
    mountedInjectors.add(inject);
    if (sharedCopiedFormat) {
      inject(`window.__editor.setCopiedFormat(${JSON.stringify(sharedCopiedFormat)})`);
    }
    return () => {
      mountedInjectors.delete(inject);
    };
  }, [ready, inject]);

  useEffect(() => {
    if (!ready) return;
    inject(`window.__editor.setPlaceholder(${JSON.stringify(placeholder || "")})`);
    inject(`window.__editor.setMinHeight(${minHeight})`);
  }, [ready, placeholder, minHeight, inject]);

  useImperativeHandle(
    editorActionsRef,
    () => ({
      focusBottom: () => {
        if (ready) inject("window.__editor.focusBottom()");
      },
      blur: () => {
        if (ready) inject("window.__editor.dismissControls()");
      },
    }),
    [ready, inject]
  );

  const onMessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === "ready") {
      setReady(true);
    } else if (msg.type === "change") {
      const marcas = htmlToMarks(msg.html);
      lastEmitted.current = marcas;
      onChangeText(marcas);
    } else if (msg.type === "height") {
      setHeight(Math.max(minHeight, msg.height));
    } else if (msg.type === "openUrl") {
      const safeUrl = sanitizeLinkUrl(msg.url);
      if (safeUrl) Linking.openURL(safeUrl).catch(() => {});
    } else if (msg.type === "copyFormat") {
      sharedCopiedFormat = msg.format || null;
      const payload = `window.__editor.setCopiedFormat(${JSON.stringify(sharedCopiedFormat)})`;
      for (const target of mountedInjectors) {
        if (target !== inject) target(payload);
      }
    }
  };

  return (
    <View style={[styles.box, page && styles.pageBox, { height }]}>
      <WebView
        ref={webRef}
        source={{ html: editorHtml }}
        originWhitelist={["*"]}
        // Antes de que el bundle cree el editor: fija el default de alineación
        // de esta cara (el frente arranca centrado). El bundle lo lee al armar
        // las extensiones.
        injectedJavaScriptBeforeContentLoaded={`window.__nfDefaultAlign=${JSON.stringify(
          defaultAlign
        )};window.__nfPage=${JSON.stringify(!!page)};true;`}
        onMessage={onMessage}
        scrollEnabled={false}
        overScrollMode="never"
        textZoom={100}
        keyboardDisplayRequiresUserAction={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(req) => {
          const reqUrl = req?.url || "";
          if (!reqUrl || reqUrl === "about:blank" || reqUrl.startsWith("data:") || reqUrl.startsWith("file:")) {
            return true;
          }
          const safeUrl = sanitizeLinkUrl(reqUrl);
          if (safeUrl) Linking.openURL(safeUrl).catch(() => {});
          return false;
        }}
        androidLayerType="hardware"
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Mismo contenedor que el Field de siempre: el editor se ve como un input.
  box: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  pageBox: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderRadius: 0,
  },
  web: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
