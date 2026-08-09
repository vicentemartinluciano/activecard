// Tarjeta deslizable estilo Quizlet: arrastrar a la derecha = la sabía,
// a la izquierda = no la sabía, hacia arriba = más o menos. PanResponder +
// Animated de RN core (compatible con Android y web, sin worklets).

import { useRef } from "react";
import { Animated, PanResponder, StyleSheet, Text, useWindowDimensions } from "react-native";

import { colors, font, radius, ratingColors } from "../theme";

const SWIPE_THRESHOLD = 90;

// Opacidad de cada señal ("La sabía" / "No la sabía" / "Más o menos") a partir
// del arrastre. Antes cada una salía suelta de su propio eje, así que un
// arrastre en diagonal encendía DOS a la vez y se leía sucio. La compuerta deja
// pasar UNA sola: el eje dominante gana y el otro se apaga, con un cruce corto
// para que no titile justo en la diagonal.
// Exportada aparte para poder testear la exclusividad sin montar el componente.
export function swipeOpacities(pan, threshold = SWIPE_THRESHOLD) {
  // Para decidir QUIÉN gana, las fuerzas van SIN clamp: pasado el umbral los
  // dos ejes saturarían en 1 y la diferencia se volvería 0 justo cuando el
  // gesto es más claro (arrastrar lejos en diagonal encendía las dos señales
  // al 50%).
  const fuerzaXCruda = pan.x.interpolate({
    inputRange: [-threshold, 0, threshold],
    outputRange: [1, 0, 1],
  });
  const fuerzaYCruda = pan.y.interpolate({
    inputRange: [-threshold, 0],
    outputRange: [1, 0],
  });
  const fuerzaY = pan.y.interpolate({
    inputRange: [-threshold, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  const dominancia = Animated.subtract(fuerzaXCruda, fuerzaYCruda);
  const gateH = dominancia.interpolate({
    inputRange: [-0.06, 0.06],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const gateV = dominancia.interpolate({
    inputRange: [-0.06, 0.06],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return {
    knew: Animated.multiply(
      pan.x.interpolate({
        inputRange: [0, threshold],
        outputRange: [0, 1],
        extrapolate: "clamp",
      }),
      gateH
    ),
    forgot: Animated.multiply(
      pan.x.interpolate({
        inputRange: [-threshold, 0],
        outputRange: [1, 0],
        extrapolate: "clamp",
      }),
      gateH
    ),
    middle: Animated.multiply(fuerzaY, gateV),
  };
}

export default function SwipeCard({ children, onSwipeLeft, onSwipeRight, onSwipeUp }) {
  const { width, height } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;
  const frameRef = useRef(null);

  // En Android/Fabric una capa absoluta sobre FlipCard se separaba de la
  // tarjeta al rotar: terminaba viéndose como una raya luminosa abajo. Acá
  // coloreamos el borde DEL MISMO nodo que se mueve y rota, por lo que las
  // cuatro aristas quedan físicamente pegadas a la tarjeta.
  const paintFrame = (gesture) => {
    const horizontal = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
    const magnitude = horizontal ? Math.abs(gesture.dx) : Math.max(0, -gesture.dy);
    if (magnitude < 3 || (!horizontal && !onSwipeUp)) {
      frameRef.current?.setNativeProps({ style: { borderColor: "transparent" } });
      return;
    }
    const color = horizontal
      ? gesture.dx >= 0 ? ratingColors.good : ratingColors.again
      : ratingColors.hard;
    const alpha = Math.round((0.35 + Math.min(1, magnitude / SWIPE_THRESHOLD) * 0.65) * 255)
      .toString(16)
      .padStart(2, "0");
    frameRef.current?.setNativeProps({ style: { borderColor: `${color}${alpha}` } });
  };

  const clearFrame = () => {
    frameRef.current?.setNativeProps({ style: { borderColor: "transparent" } });
  };

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
      clearFrame();
      if (direction > 0) latest.current.onSwipeRight();
      else latest.current.onSwipeLeft();
    });
  };

  // Vuelo hacia arriba = "Más o menos" (Hard). Solo se dispara si hay callback.
  const flyUp = () => {
    if (!latest.current.onSwipeUp) {
      clearFrame();
      Animated.timing(pan, {
        toValue: { x: 0, y: 0 },
        duration: 130,
        useNativeDriver: false,
      }).start();
      return;
    }
    Animated.timing(pan, {
      toValue: { x: 0, y: -latest.current.height * 1.2 },
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      clearFrame();
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
        listener: (_, gesture) => paintFrame(gesture),
      }),
      onPanResponderRelease: (_, g) => {
        if (g.dx > SWIPE_THRESHOLD) flyOut(1);
        else if (g.dx < -SWIPE_THRESHOLD) flyOut(-1);
        else if (g.dy < -SWIPE_THRESHOLD) flyUp();
        else {
          // El color se apaga al soltar, no cuando termina el retorno. Con el
          // spring anterior la tarjeta quedaba inclinada y coloreada casi un
          // segundo aunque el swipe se hubiera cancelado.
          clearFrame();
          Animated.timing(pan, {
            toValue: { x: 0, y: 0 },
            duration: 130,
            useNativeDriver: false,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        clearFrame();
        Animated.timing(pan, {
          toValue: { x: 0, y: 0 },
          duration: 130,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  const rotate = pan.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-12deg", "0deg", "12deg"],
  });

  const {
    knew: knewOpacity,
    forgot: forgotOpacity,
    middle: middleOpacity,
  } = swipeOpacities(pan);

  return (
    <Animated.View
      ref={frameRef}
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
        <Text style={[styles.badgeText, { color: ratingColors.good }]}>La sabía</Text>
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.badge, styles.badgeLeft, { opacity: forgotOpacity }]}
      >
        <Text style={[styles.badgeText, { color: ratingColors.again }]}>No la sabía</Text>
      </Animated.View>
      {onSwipeUp ? (
        <Animated.View pointerEvents="none" style={[styles.badgeUp, { opacity: middleOpacity }]}>
          <Text style={[styles.badgeText, { color: ratingColors.hard }]}>Más o menos</Text>
        </Animated.View>
      ) : null}
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderWidth: 3,
    borderColor: "transparent",
    borderRadius: radius.lg,
  },
  badge: {
    position: "absolute",
    top: 20,
    zIndex: 10,
    borderWidth: 2.5,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
  },
  badgeRight: {
    left: 16,
    borderColor: ratingColors.good,
    transform: [{ rotate: "-12deg" }],
  },
  badgeLeft: {
    right: 16,
    borderColor: ratingColors.again,
    transform: [{ rotate: "12deg" }],
  },
  badgeUp: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    zIndex: 10,
    borderWidth: 2.5,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.bg,
    borderColor: ratingColors.hard,
  },
  badgeText: {
    ...font(800),
    fontSize: 22,
    letterSpacing: 0.3,
  },
});
