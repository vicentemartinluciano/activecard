// Tarjeta deslizable estilo Quizlet: arrastrar a la derecha = la sabía,
// a la izquierda = no la sabía, hacia arriba = más o menos. PanResponder +
// Animated de RN core (compatible con Android y web, sin worklets).

import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Animated, PanResponder, Platform, StyleSheet, Text, useWindowDimensions } from "react-native";

import { colors, font, radius, ratingColors } from "../theme";
import { createStudyMouseDrag, studyDragDirection } from '../lib/studyMouseDrag';
import { createStudyMotion } from '../lib/studyMotion';

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

export default function SwipeCard({ ref, cardId, children, onSwipeLeft, onSwipeRight, onSwipeUp }) {
  const { width, height } = useWindowDimensions();
  const pan = useRef(new Animated.ValueXY()).current;
  const frameRef = useRef(null);
  const motion = useRef(null);
  const mouse = useRef(null);
  const [armed, setArmed] = useState(false);
  const [error, setError] = useState('');
  const [borderColor, setBorderColor] = useState('transparent');

  const updateFrame = (color) => {
    // RN Web entrega un elemento DOM, sin setNativeProps. El intento de usar
    // esa API cortaba move/cancel después de mover la tarjeta: quedaba trabada.
    if (Platform.OS === 'web') setBorderColor(color);
    else frameRef.current?.setNativeProps?.({ style: { borderColor: color } });
  };

  // En Android/Fabric una capa absoluta sobre FlipCard se separaba de la
  // tarjeta al rotar: terminaba viéndose como una raya luminosa abajo. Acá
  // coloreamos el borde DEL MISMO nodo que se mueve y rota, por lo que las
  // cuatro aristas quedan físicamente pegadas a la tarjeta.
  const paintFrame = (gesture) => {
    const horizontal = Math.abs(gesture.dx) >= Math.abs(gesture.dy);
    const magnitude = horizontal ? Math.abs(gesture.dx) : Math.max(0, -gesture.dy);
    if (magnitude < 3 || (!horizontal && !latest.current.onSwipeUp)) {
      updateFrame('transparent');
      return;
    }
    const color = horizontal
      ? gesture.dx >= 0 ? ratingColors.good : ratingColors.again
      : ratingColors.hard;
    const alpha = Math.round((0.35 + Math.min(1, magnitude / SWIPE_THRESHOLD) * 0.65) * 255)
      .toString(16)
      .padStart(2, "0");
    updateFrame(`${color}${alpha}`);
  };

  const clearFrame = () => {
    updateFrame('transparent');
  };

  // El PanResponder se crea UNA sola vez por montaje y captura el vuelo del
  // primer render. Sin estos refs, el swipe llamaba a callbacks VIEJOS: si
  // armabas el rayo ⚡ y calificabas deslizando, corría un grade() con
  // gymArmed=false y el Gimnasio nunca se abría. Los refs siempre apuntan a
  // los props/valores del último render.
  const latest = useRef({ onSwipeLeft, onSwipeRight, onSwipeUp, width, height });
  latest.current = { onSwipeLeft, onSwipeRight, onSwipeUp, width, height };

  // Un único dueño de la posición evita que PanResponder y Pointer Events
  // escriban el mismo Animated.Value en web después de soltar el gesto.
  if (!motion.current) motion.current = createStudyMotion({
    animate: (toValue, duration, done) => {
      const animation = Animated.timing(pan, { toValue, duration, useNativeDriver: false });
      animation.start(done);
      return animation;
    },
    setPosition: (point) => pan.setValue(point),
    paint: paintFrame,
    clear: clearFrame,
    getTarget: (rating) => rating === 'hard'
      ? { x: 0, y: -latest.current.height * 1.2 }
      : { x: (rating === 'good' ? 1 : -1) * latest.current.width * 1.2, y: 0 },
    getGrade: (rating) => ({ again: latest.current.onSwipeLeft, hard: latest.current.onSwipeUp, good: latest.current.onSwipeRight })[rating],
  });
  const swipe = (rating) => {
    setError('');
    return motion.current.swipe(rating).catch((cause) => {
      setError('No pudimos guardar el repaso. Volvé a intentar.');
      throw cause;
    });
  };
  const release = (rating) => { swipe(rating).catch(() => {}); };
  useImperativeHandle(ref, () => ({ swipe, isBusy: motion.current.isBusy }));
  useEffect(() => {
    motion.current.reset();
    mouse.current?.reset();
    setError('');
    return () => { motion.current.reset(); };
  }, [cardId]);

  if (!mouse.current) mouse.current = createStudyMouseDrag({
    isBusy: motion.current.isBusy,
    move: motion.current.move,
    release,
    cancel: motion.current.cancel,
    onArmedChange: setArmed,
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const cancel = () => mouse.current.reset();
    const escape = (event) => { if (event.key === 'Escape') cancel(); };
    const hidden = () => { if (document.hidden) cancel(); };
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', hidden);
    document.addEventListener('keydown', escape);
    return () => {
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', hidden);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const responder = useRef(null);
  if (!responder.current) responder.current = PanResponder.create({
    // Tomar el gesto con arrastre horizontal real (para no robarle el tap al
    // flip) o con arrastre vertical hacia ARRIBA dominante. El hacia arriba
    // solo llega acá cuando el dorso no scrollea: si el ScrollView interno
    // tiene contenido, se queda él con el gesto vertical (y el botón azul
    // queda como camino confiable). Hacia abajo nunca lo tomamos.
    onMoveShouldSetPanResponder: (_, g) =>
      !motion.current.isBusy() && (
        (Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy)) ||
        (g.dy < -12 && Math.abs(g.dy) > Math.abs(g.dx))),
    onPanResponderMove: (_, gesture) => motion.current.move(gesture),
    onPanResponderRelease: (_, gesture) => {
      const direction = studyDragDirection(gesture.dx, gesture.dy);
      if (direction) release(direction);
      else motion.current.cancel();
    },
    onPanResponderTerminate: () => motion.current.cancel(),
  });

  const rotate = pan.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ["-12deg", "0deg", "12deg"],
  });

  const {
    knew: knewOpacity,
    forgot: forgotOpacity,
    middle: middleOpacity,
  } = swipeOpacities(pan);

  const card = (
    <Animated.View
      ref={frameRef}
      {...(Platform.OS === 'web' ? {} : responder.current.panHandlers)}
      style={[
        styles.container,
        Platform.OS === 'web' && { borderColor },
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
  return Platform.OS === 'web'
    ? <div data-study-drag="true" {...mouse.current.handlers} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: 0, userSelect: 'none', touchAction: armed ? 'none' : 'pan-y', cursor: armed ? 'grabbing' : 'auto' }}>{card}{!!error && <Text style={{ color: colors.danger }}>{error}</Text>}</div>
    : card;
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
