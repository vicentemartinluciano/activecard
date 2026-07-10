// Tarjeta deslizable estilo Quizlet: arrastrar a la derecha = la sabía,
// a la izquierda = no la sabía. PanResponder + Animated de RN core
// (compatible con Android y web, sin worklets).

import { useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, useWindowDimensions } from "react-native";

import { colors, radius } from "../theme";

const SWIPE_THRESHOLD = 90;

export default function SwipeCard({ children, onSwipeLeft, onSwipeRight, cardKey }) {
  const { width } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;

  const flyOut = (direction) => {
    Animated.timing(pan, {
      toValue: { x: direction * width * 1.2, y: 0 },
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      if (direction > 0) onSwipeRight();
      else onSwipeLeft();
    });
  };

  const responder = useRef(
    PanResponder.create({
      // Solo tomar el gesto cuando hay arrastre horizontal real,
      // para no robarle el tap al flip de la tarjeta.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) flyOut(1);
        else if (g.dx < -SWIPE_THRESHOLD) flyOut(-1);
        else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 6,
          }).start();
        }
      },
    })
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-12deg", "0deg", "12deg"],
  });
  const knewOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const forgotOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      key={cardKey}
      {...responder.panHandlers}
      style={[
        styles.container,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] },
      ]}
    >
      <Animated.View style={[styles.badge, styles.badgeRight, { opacity: knewOpacity }]}>
        <Text style={[styles.badgeText, { color: colors.success }]}>La sabía</Text>
      </Animated.View>
      <Animated.View style={[styles.badge, styles.badgeLeft, { opacity: forgotOpacity }]}>
        <Text style={[styles.badgeText, { color: colors.danger }]}>No la sabía</Text>
      </Animated.View>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  badge: {
    position: "absolute",
    top: 16,
    zIndex: 10,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.bg,
  },
  badgeRight: {
    left: 16,
    borderColor: colors.success,
    transform: [{ rotate: "-12deg" }],
  },
  badgeLeft: {
    right: 16,
    borderColor: colors.danger,
    transform: [{ rotate: "12deg" }],
  },
  badgeText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
