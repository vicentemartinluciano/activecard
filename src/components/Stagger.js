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

import { Children, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated } from "react-native";

const STEP = 45; // ms entre un hijo y el siguiente
const DURATION = 260; // ms que dura cada entrada
const OFFSET = 12; // px que sube cada hijo al entrar
const MAX_ANIMATED = 8; // a partir de acá entran sin animación

function StaggerItem({ index, step, style, animate, children }) {
  // Arranca visible si no hay que animar: nada de esperar a un efecto para
  // que el contenido exista.
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;

  useEffect(() => {
    if (!animate) {
      progress.setValue(1);
      return undefined;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      delay: index * step,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [animate, index, step, progress]);

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

export default function Stagger({ children, step = STEP, style, disabled = false }) {
  const [reduceMotion, setReduceMotion] = useState(false);

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
    <StaggerItem index={i} step={step} style={style} animate={!off && i < MAX_ANIMATED}>
      {child}
    </StaggerItem>
  ));
}

// Para listas virtualizadas (FlatList), donde no hay un contenedor con todos
// los hijos: se usa por ítem, con su índice.
export function StaggerRow({ index, children, style }) {
  return (
    <StaggerItem index={index} step={STEP} style={style} animate={index < MAX_ANIMATED}>
      {children}
    </StaggerItem>
  );
}
