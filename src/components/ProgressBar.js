// Barra de progreso fina y redondeada (estilo Quizlet).

import { StyleSheet, View } from "react-native";

import { colors } from "../theme";

export default function ProgressBar({ pct, color = colors.accent, style }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceHigh,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
  },
});
