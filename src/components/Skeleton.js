// Caja fantasma con shimmer de opacidad para estados de carga.
import { useEffect, useRef } from "react";
import { Animated } from "react-native";

import { colors, radius } from "../theme";

export default function Skeleton({ height = 16, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ height, borderRadius: radius.md, backgroundColor: colors.surfaceHigh, opacity }, style]}
    />
  );
}
