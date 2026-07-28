// Slider custom (sin dependencias nativas). Track + relleno + arrastre/tap con
// Pan de react-native-gesture-handler (funciona en Android y web).
//
// Nació como slider de prioridad 0-100 en pasos de 5, y por eso esos son los
// defaults: los llamados viejos siguen andando sin tocar nada. Con min/max/step
// y formatLabel sirve también para los topes diarios, que tienen otro rango y
// no muestran "Pausado".

import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { colors, font, spacing, tabular } from "../theme";

const defaultLabel = (v) => (v === 0 ? "Pausado" : `${v}%`);

export default function PercentSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 5,
  formatLabel = defaultLabel,
}) {
  const [width, setWidth] = useState(0);
  const [dragPct, setDragPct] = useState(null); // preview mientras se arrastra
  const pct = dragPct != null ? dragPct : value;
  const ratio = max > min ? (pct - min) / (max - min) : 0;

  const pctFromX = (x) => {
    if (!width) return value;
    const raw = min + Math.max(0, Math.min(1, x / width)) * (max - min);
    return Math.max(min, Math.min(max, Math.round(raw / step) * step));
  };

  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => setDragPct(pctFromX(e.x)))
    .onUpdate((e) => setDragPct(pctFromX(e.x)))
    .onFinalize((e) => {
      const p = pctFromX(e.x);
      setDragPct(null);
      if (p !== value) onChange(p);
    });

  return (
    <View style={styles.row}>
      <GestureDetector gesture={pan}>
        <View style={styles.touchArea} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                { width: `${ratio * 100}%` },
                pct === 0 && { backgroundColor: colors.textMuted },
              ]}
            />
          </View>
          <View style={[styles.thumb, { left: `${ratio * 100}%` }]} />
        </View>
      </GestureDetector>
      <Text style={[styles.label, pct === 0 && { color: colors.textMuted }]}>
        {formatLabel(pct)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  touchArea: {
    flex: 1,
    height: 36,
    justifyContent: "center",
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  thumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.text,
    marginLeft: -9,
    top: 9,
  },
  label: {
    color: colors.accentText,
    fontSize: 14,
    ...font(700),
    ...tabular,
    width: 64,
    textAlign: "right",
  },
});
