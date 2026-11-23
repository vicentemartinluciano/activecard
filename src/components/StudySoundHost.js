import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { STUDY_SOUND_HTML } from "../lib/studySoundScript";
import {
  isStudySoundsEnabled,
  loadStudySoundsEnabled,
  registerStudySoundBridge,
  subscribeStudySoundsEnabled,
} from "../lib/studySounds";

let NativeWebView = null;
try {
  NativeWebView = require("react-native-webview")?.WebView || null;
} catch {
  NativeWebView = null;
}

export default function StudySoundHost({ forceMount = false } = {}) {
  const webRef = useRef(null);
  const [enabled, setEnabled] = useState(() => isStudySoundsEnabled());

  useEffect(() => {
    let alive = true;
    loadStudySoundsEnabled().then((val) => {
      if (alive) setEnabled(val);
    });
    const unsub = subscribeStudySoundsEnabled((val) => {
      if (alive) setEnabled(val);
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  const shouldMount = (enabled || forceMount) && Boolean(NativeWebView) && Platform.OS !== "web";

  useEffect(() => {
    if (!shouldMount) return undefined;
    return registerStudySoundBridge((kind) => {
      webRef.current?.injectJavaScript(
        `window.__acPlaySound && window.__acPlaySound(${JSON.stringify(kind)}); true;`
      );
    });
  }, [shouldMount]);

  if (!shouldMount) return null;

  return (
    <View pointerEvents="none" style={styles.hiddenHost}>
      <NativeWebView
        ref={webRef}
        source={{ html: STUDY_SOUND_HTML }}
        originWhitelist={["*"]}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        scrollEnabled={false}
        setSupportMultipleWindows={false}
        style={styles.hiddenWeb}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenHost: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    left: -10,
    top: -10,
    overflow: "hidden",
  },
  hiddenWeb: {
    width: 1,
    height: 1,
    backgroundColor: "transparent",
  },
});
