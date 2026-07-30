// Segmento cobalto que recorre el contorno real de una tarjeta. SVG dibuja una
// única trayectoria redondeada: no hay cuatro lados que puedan saltar en las
// esquinas ni un contenedor extra que deje ver un borde negro.

import { useEffect, useId, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

const VUELTA = 6800;
const SEGMENT_RATIO = 0.34;
const AnimatedPath = Animated.createAnimatedComponent(Path);

export function useBeam(total = 1, { duration = VUELTA, disabled = false } = {}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (disabled) {
      progress.setValue(-1);
      return undefined;
    }
    progress.setValue(0);
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: total,
        duration: duration * total,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, duration, progress, total]);

  return disabled ? null : progress;
}

export function roundedRectPath(width, height, radius, inset) {
  const left = inset;
  const top = inset;
  const right = Math.max(left, width - inset);
  const bottom = Math.max(top, height - inset);
  const r = Math.max(0, Math.min(radius - inset, (right - left) / 2, (bottom - top) / 2));
  return [
    `M ${left + r} ${top}`,
    `H ${right - r}`,
    `Q ${right} ${top} ${right} ${top + r}`,
    `V ${bottom - r}`,
    `Q ${right} ${bottom} ${right - r} ${bottom}`,
    `H ${left + r}`,
    `Q ${left} ${bottom} ${left} ${bottom - r}`,
    `V ${top + r}`,
    `Q ${left} ${top} ${left + r} ${top}`,
    "Z",
  ].join(" ");
}

export default function BorderBeam({
  progress,
  index = 0,
  thickness = 2.2,
  radius = 0,
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [webProgress, setWebProgress] = useState(-1);
  const gradientId = `beam-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    if (Platform.OS !== "web" || !progress) return undefined;
    const listener = progress.addListener(({ value }) => setWebProgress(value));
    return () => progress.removeListener(listener);
  }, [progress]);

  if (!progress) return null;

  const inset = Math.max(2, thickness);
  const path = roundedRectPath(size.width, size.height, radius, inset);
  const effectiveRadius = Math.max(
    0,
    Math.min(radius - inset, (size.width - inset * 2) / 2, (size.height - inset * 2) / 2)
  );
  const perimeter = Math.max(
    1,
    2 * (size.width + size.height - inset * 4 - effectiveRadius * 4) +
      2 * Math.PI * effectiveRadius
  );
  const segment = Math.max(24, perimeter * SEGMENT_RATIO);
  const gap = Math.max(1, perimeter - segment);
  const offset = progress.interpolate({
    inputRange: [index, index + 1],
    outputRange: [0, -perimeter],
    extrapolate: "clamp",
  });
  const opacity = progress.interpolate({
    inputRange: [index - 0.001, index, index + 1, index + 1.001],
    outputRange: [0, 1, 1, 0],
    extrapolate: "clamp",
  });
  const webLocal = Math.max(0, Math.min(1, webProgress - index));
  const pathOffset = Platform.OS === "web" ? -perimeter * webLocal : offset;
  const pathOpacity =
    Platform.OS === "web"
      ? webProgress >= index && webProgress <= index + 1
        ? 1
        : 0
      : opacity;
  const BeamPath = Platform.OS === "web" ? Path : AnimatedPath;

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setSize({ width, height });
      }}
      style={[StyleSheet.absoluteFill, { opacity: pathOpacity }]}
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0" stopColor="rgba(62,99,221,0.18)" />
              <Stop offset="0.62" stopColor="rgba(62,99,221,0.78)" />
              <Stop offset="1" stopColor="rgba(146,175,255,0.98)" />
            </LinearGradient>
          </Defs>
          <BeamPath
            d={path}
            fill="none"
            stroke="rgba(62,99,221,0.20)"
            strokeWidth={thickness + 5}
            strokeLinecap="round"
            strokeDasharray={[segment, gap]}
            strokeDashoffset={pathOffset}
          />
          <BeamPath
            d={path}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={[segment, gap]}
            strokeDashoffset={pathOffset}
          />
        </Svg>
      ) : null}
    </Animated.View>
  );
}
