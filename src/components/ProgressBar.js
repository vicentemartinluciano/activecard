// Barra de progreso fina y redondeada (estilo Quizlet).
// glowStyle: resplandor neón opcional (tokens de theme.glow). Va en el track
// porque su overflow:hidden se comería el boxShadow del fill.

import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { colors, radius } from "../theme";

export default function ProgressBar({ pct, color = colors.accent, gradient, glowStyle, style }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  return (
    <View style={[styles.track, glowStyle, style]}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, { width: `${clamped}%` }]}
        />
      ) : (
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: color }]} />
      )}
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
