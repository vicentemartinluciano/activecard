import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";

const STARS = [
  [7, 8, 1], [18, 15, 1.5], [31, 5, 1], [47, 12, 1], [62, 7, 1.5], [79, 16, 1], [92, 6, 1],
  [12, 28, 1], [25, 35, 1], [39, 24, 1.5], [57, 31, 1], [72, 26, 1], [88, 38, 1.5],
  [5, 52, 1.5], [20, 61, 1], [35, 48, 1], [51, 57, 1], [68, 49, 1.5], [83, 63, 1],
  [11, 77, 1], [29, 71, 1.5], [45, 83, 1], [60, 74, 1], [76, 87, 1.5], [94, 72, 1],
];

export default function StarField() {
  const flight = useRef(new Animated.Value(0)).current;
  const stars = useMemo(() => STARS, []);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const launch = () => {
      if (cancelled) return;
      flight.setValue(0);
      Animated.timing(flight, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: Platform.OS !== "web",
      }).start(() => {
        if (!cancelled) timer = setTimeout(launch, 15000 + Math.random() * 15000);
      });
    };
    timer = setTimeout(launch, 7000 + Math.random() * 8000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      flight.stopAnimation();
    };
  }, [flight]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={styles.halo} />
      {stars.map(([left, top, size], index) => (
        <View key={index} style={[styles.star, { left: `${left}%`, top: `${top}%`, width: size, height: size }]} />
      ))}
      <Animated.View
        style={[
          styles.shooting,
          {
            opacity: flight.interpolate({ inputRange: [0, 0.12, 0.72, 1], outputRange: [0, 0.45, 0.3, 0] }),
            transform: [
              { translateX: flight.interpolate({ inputRange: [0, 1], outputRange: [-30, 115] }) },
              { translateY: flight.interpolate({ inputRange: [0, 1], outputRange: [0, 95] }) },
              { rotate: "34deg" },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(13,31,65,0.16)",
  },
  star: {
    position: "absolute",
    borderRadius: 2,
    backgroundColor: "rgba(170,205,255,0.42)",
  },
  shooting: {
    position: "absolute",
    top: "18%",
    right: "17%",
    width: 58,
    height: 1,
    borderRadius: 1,
    backgroundColor: "rgba(140,205,255,0.8)",
  },
});
