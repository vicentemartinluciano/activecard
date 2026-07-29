// Entrada escalonada ("escalerita"): los hijos aparecen uno tras otro con un
// retraso incremental, así la pantalla se ARMA en vez de aparecer de golpe.
//
// POR QUÉ NO USA `entering` DE REANIMATED: las layout animations dejan el
// elemento en `visibility: hidden` hasta que la animación arranca, y si por lo
// que sea no arranca (contenido montado sin layout, pantalla que aún no tiene
// tamaño), el contenido queda INVISIBLE PARA SIEMPRE. Pasó con la pantalla
// Progreso: las tres cards existían en el DOM, con su tamaño correcto, y no se
// veían. Con Animated el valor lo manejamos nosotros: el peor caso es que
// aparezca sin animar, nunca que no aparezca.

import { useFocusEffect } from "expo-router";
import { Children, useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform } from "react-native";

// react-native-web no tiene native driver: pedirlo deja la animacion quieta.
const NATIVE_DRIVER = Platform.OS !== "web";

const STEP = 45; // ms entre un hijo y el siguiente
const DURATION = 260; // ms que dura cada entrada
const OFFSET = 12; // px que sube cada hijo al entrar
const MAX_ANIMATED = 8; // a partir de acá entran sin animación

function StaggerItem({ index, step, style, animate, focusKey, children }) {
  // Arranca visible si no hay que animar: nada de esperar a un efecto para
  // que el contenido exista.
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) {
      progress.setValue(1);
      return undefined;
    }
    // focusKey en las deps: las pantallas de tabs NO se desmontan al cambiar de
    // sección, así que sin esto la escalerita corría una sola vez en la vida de
    // la app. Cada vez que la pantalla vuelve a estar en foco, se rearma.
    progress.setValue(0);
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      delay: index * step,
      useNativeDriver: NATIVE_DRIVER,
    });
    anim.start();
    return () => anim.stop();
  }, [animate, index, step, progress, focusKey]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [OFFSET, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Cuenta cuántas veces la pantalla pasó a estar en foco: cambiar ese número es
// lo que vuelve a disparar la animación. Las pantallas de tabs NO se desmontan
// al cambiar de sección, así que sin esto la escalerita corría una sola vez en
// toda la vida de la app.
//
// En listas (FlatList) llamalo UNA vez en la pantalla y pasá el valor a cada
// StaggerRow: un useFocusEffect por fila serían decenas de suscripciones.
export function useStaggerKey() {
  const [focusKey, setFocusKey] = useState(1);

  useFocusEffect(
    useCallback(() => {
      setFocusKey((k) => k + 1);
    }, [])
  );

  return focusKey;
}

export default function Stagger({ children, step = STEP, style, disabled = false }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const focusKey = useStaggerKey();

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduceMotion(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) =>
      setReduceMotion(!!v)
    );
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  const off = disabled || reduceMotion;

  return Children.map(Children.toArray(children), (child, i) => (
    <StaggerItem
      index={i}
      step={step}
      style={style}
      animate={!off && i < MAX_ANIMATED}
      focusKey={focusKey}
    >
      {child}
    </StaggerItem>
  ));
}

// Para listas virtualizadas (FlatList), donde no hay un contenedor con todos
// los hijos. `refreshKey` viene de useStaggerKey() llamado UNA vez en la
// pantalla: al cambiar, las filas visibles vuelven a entrar.
export function StaggerRow({ index, children, style, refreshKey = 0 }) {
  return (
    <StaggerItem
      index={index}
      step={STEP}
      style={style}
      animate={index < MAX_ANIMATED}
      focusKey={refreshKey}
    >
      {children}
    </StaggerItem>
  );
}
