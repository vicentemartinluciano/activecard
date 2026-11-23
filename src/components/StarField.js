import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

const STARS = [
  [10, 12, 1],
  [26, 8, 1],
  [44, 16, 1.5],
  [68, 10, 1],
  [86, 19, 1],
  [18, 34, 1],
  [54, 29, 1],
  [79, 39, 1.5],
  [12, 58, 1],
  [37, 52, 1],
  [65, 61, 1],
  [88, 56, 1],
  [24, 78, 1],
  [51, 71, 1],
  [72, 82, 1.5],
  [92, 74, 1],
];

/** Fondo estelar estático y sutil; sin timers ni animaciones en segundo plano. */
export default function StarField() {
  const stars = useMemo(() => STARS, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.halo} />
      {stars.map(([left, top, size], index) => (
        <View
          key={index}
          style={[styles.star, { left: `${left}%`, top: `${top}%`, width: size, height: size }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,20,35,0.05)",
  },
  star: {
    position: "absolute",
    borderRadius: 2,
    backgroundColor: "rgba(170,185,215,0.28)",
  },
});
