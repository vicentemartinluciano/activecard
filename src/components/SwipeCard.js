// Tarjeta deslizable estilo Quizlet: arrastrar a la derecha = la sabía,
// a la izquierda = no la sabía, hacia arriba = más o menos. PanResponder +
// Animated de RN core (compatible con Android y web, sin worklets).

import { useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, useWindowDimensions } from "react-native";

import { colors, radius } from "../theme";

const SWIPE_THRESHOLD = 90;

export default function SwipeCard({ children, onSwipeLeft, onSwipeRight, onSwipeUp }) {
  const { width, height } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;

  // El PanResponder se crea UNA sola vez por montaje y captura el flyOut del
  // primer render. Sin estos refs, el swipe llamaba a callbacks VIEJOS: si
  // armabas el rayo ⚡ y calificabas deslizando, corría un grade() con
  // gymArmed=false y el Gimnasio nunca se abría. Los refs siempre apuntan a
  // los props/valores del último render.
  const latest = useRef({ onSwipeLeft, onSwipeRight, onSwipeUp, width, height });
  latest.current = { onSwipeLeft, onSwipeRight, onSwipeUp, width, height };

  // useNativeDriver false a propósito: onPanResponderMove maneja el MISMO `pan`
  // con driver JS, y mezclar ambos drivers sobre un mismo nodo animado deja el
  // gesto en estado inconsistente en Android new-arch.
  const flyOut = (direction) => {
    Animated.timing(pan, {
      toValue: { x: direction * latest.current.width * 1.2, y: 0 },
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      if (direction > 0) latest.current.onSwipeRight();
      else latest.current.onSwipeLeft();
    });
  };

  // Vuelo hacia arriba = "Más o menos" (Hard). Solo se dispara si hay callback.
  const flyUp = () => {
    if (!latest.current.onSwipeUp) {
      Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
      return;
    }
    Animated.timing(pan, {
      toValue: { x: 0, y: -latest.current.height * 1.2 },
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      latest.current.onSwipeUp();
    });
  };

  const responder = useRef(
    PanResponder.create({
      // Tomar el gesto con arrastre horizontal real (para no robarle el tap al
      // flip) o con arrastre vertical hacia ARRIBA dominante. El hacia arriba
      // solo llega acá cuando el dorso no scrollea: si el ScrollView interno
      // tiene contenido, se queda él con el gesto vertical (y el botón azul
      // queda como camino confiable). Hacia abajo nunca lo tomamos.
      onMoveShouldSetPanResponder: (_, g) =>
        (Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy)) ||
        (g.dy < -12 && Math.abs(g.dy) > Math.abs(g.dx)),
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) flyOut(1);
        else if (g.dx < -SWIPE_THRESHOLD) flyOut(-1);
        else if (g.dy < -SWIPE_THRESHOLD) flyUp();
        else {
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
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
  const middleOpacity = pan.y.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[
        styles.container,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }, { rotate }] },
      ]}
    >
      {/* pointerEvents none: aun con opacity 0 los badges capturan toques y
          tapaban la estrella/rayo de la esquina de la tarjeta. */}
      <Animated.View
        pointerEvents="none"
        style={[styles.badge, styles.badgeRight, { opacity: knewOpacity }]}
      >
        <Text style={[styles.badgeText, { color: colors.success }]}>La sabía</Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.badge, styles.badgeLeft, { opacity: forgotOpacity }]}
      >
        <Text style={[styles.badgeText, { color: colors.danger }]}>No la sabía</Text>
      </Animated.View>
      {onSwipeUp ? (
        <Animated.View pointerEvents="none" style={[styles.badgeUp, { opacity: middleOpacity }]}>
          <Text style={[styles.badgeText, { color: colors.accentText }]}>Más o menos</Text>
        </Animated.View>
      ) : null}
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
  badgeUp: {
    position: "absolute",
    top: 16,
    alignSelf: "center",
    zIndex: 10,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.bg,
    borderColor: colors.accentText,
  },
  badgeText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
