// Barra de progreso fina y redondeada (estilo Quizlet).
// glowStyle: resplandor neón opcional (tokens de theme.glow). Va en el FILL
// (no en el track) para que el neón acompañe solo hasta donde llegó el
// progreso; por eso el track NO lleva overflow hidden (recortaría el glow).

import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";

import { colors, radius } from "../theme";

const NATIVE_DRIVER = Platform.OS !== "web";

export default function ProgressBar({
  pct,
  color = colors.accent,
  gradient,
  glowStyle,
  style,
  animated = true,
}) {
  const numeric = Number(pct);
  const clamped = Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0;
  const [trackWidth, setTrackWidth] = useState(0);
  const progress = useRef(new Animated.Value(clamped)).current;
  const hasMounted = useRef(false);
  const prevClamped = useRef(clamped);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      prevClamped.current = clamped;
      progress.setValue(clamped);
      return undefined;
    }
    if (prevClamped.current === clamped) return undefined;
    prevClamped.current = clamped;
    if (!animated || trackWidth <= 0) {
      progress.stopAnimation();
      progress.setValue(clamped);
      return undefined;
    }
    const anim = Animated.timing(progress, {
      toValue: clamped,
      duration: 220,
      ...(Easing?.out ? { easing: Easing.out(Easing.cubic) } : {}),
      useNativeDriver: NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [clamped, animated, trackWidth, progress]);

  const fillGlow = clamped > 0 ? glowStyle : null;

  return (
    <View
      style={[styles.track, style]}
      onLayout={(event) => {
        const nextWidth = event?.nativeEvent?.layout?.width || 0;
        if (nextWidth > 0 && nextWidth !== trackWidth) setTrackWidth(nextWidth);
      }}
    >
      {clamped <= 0 ? null : trackWidth > 0 ? (
        <Animated.View
          style={[
            styles.fill,
            fillGlow,
            {
              width: "100%",
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 100],
                    outputRange: [-trackWidth / 2, 0],
                  }),
                },
                {
                  scaleX: progress.interpolate({
                    inputRange: [0, 100],
                    outputRange: [0, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {gradient ? (
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.innerFill}
            />
          ) : (
            <View style={[styles.innerFill, { backgroundColor: color }]} />
          )}
        </Animated.View>
      ) : gradient ? (
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
  innerFill: {
    flex: 1,
    borderRadius: radius.pill,
  },
});
