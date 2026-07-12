// Barra de progreso fina y redondeada (estilo Quizlet).

import { StyleSheet, View } from "react-native";

import { colors, radius } from "../theme";

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
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
});
