// Barra de progreso fina y redondeada (estilo Quizlet).
// glowStyle: resplandor neón opcional (tokens de theme.glow). Va en el FILL
// (no en el track) para que el neón acompañe solo hasta donde llegó el
// progreso; por eso el track NO lleva overflow hidden (recortaría el glow) —
// el fill se redondea con su propio borderRadius.

import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

import { colors, radius } from "../theme";

export default function ProgressBar({ pct, color = colors.accent, gradient, glowStyle, style }) {
  const clamped = Math.max(0, Math.min(100, pct || 0));
  const fillGlow = clamped > 0 ? glowStyle : null;
  return (
    <View style={[styles.track, style]}>
      {gradient ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, fillGlow, { width: `${clamped}%` }]}
        />
      ) : (
        <View style={[styles.fill, fillGlow, { width: `${clamped}%`, backgroundColor: color }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
  },
});
