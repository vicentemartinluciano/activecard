// Brillo que va de una tarjeta a la otra, en secuencia: se enciende la
// primera, después la segunda, después la tercera, y vuelve bajando. Le da vida
// al hub de Crear, donde antes solo brillaba la card de IA y de forma fija.
//
// El boxShadow NO se puede interpolar con Animated, así que cada tarjeta lleva
// una capa absoluta con el halo puesto y lo que se anima es su OPACIDAD. La
// capa va con pointerEvents none: una View con opacity 0 igual captura toques
// (trampa vieja de este proyecto).
//
// useSequentialGlow(n) devuelve un array de estilos animados, uno por tarjeta.

import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";

// react-native-web no tiene native driver: pedirlo deja la animacion quieta.
const NATIVE_DRIVER = Platform.OS !== "web";

const PASO = 700; // ms que tarda el brillo en pasar de una tarjeta a la otra
const ESPERA = 600; // ms de pausa al llegar a la punta, antes de volver

export function useSequentialGlow(count, { disabled = false } = {}) {
  const pos = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const off = disabled || reduceMotion || count < 2;

  useEffect(() => {
    if (off) {
      pos.setValue(0);
      return undefined;
    }
    const ultimo = count - 1;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pos, {
          toValue: ultimo,
          duration: PASO * ultimo,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.delay(ESPERA),
        Animated.timing(pos, {
          toValue: 0,
          duration: PASO * ultimo,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: NATIVE_DRIVER,
        }),
        Animated.delay(ESPERA),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [off, count, pos]);

  // Cada tarjeta está al máximo cuando el brillo la pisa y se apaga al alejarse.
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        opacity: off
          ? 0
          : pos.interpolate({
              inputRange: [i - 1, i, i + 1],
              outputRange: [0, 1, 0],
              extrapolate: "clamp",
            }),
      })),
    [count, off, pos]
  );
}

// Capa que pinta el halo. Va DENTRO de la tarjeta, absoluta y sin capturar
// toques.
export function GlowLayer({ style, halo, radius }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: radius,
        },
        halo,
        style,
      ]}
    />
  );
}
