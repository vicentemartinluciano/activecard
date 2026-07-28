// Entrada escalonada ("escalerita"): los hijos aparecen uno tras otro con un
// retraso incremental, así la pantalla se ARMA en vez de aparecer de golpe.
//
// Usa react-native-reanimated, que ya está en el binario desde el scaffolding
// inicial — o sea que esto viaja por OTA, sin APK nuevo.
//
// MAX_ANIMATED existe por una razón práctica: en una lista de 80 tarjetas, sin
// tope, la última entraría varios segundos tarde. A partir de ese índice los
// hijos aparecen sin animación.

import { Children, useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

const STEP = 45; // ms entre un hijo y el siguiente
const DURATION = 260; // ms que dura cada entrada
const MAX_ANIMATED = 8; // a partir de acá, sin animación

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
    <Animated.View
      style={style}
      entering={off || i >= MAX_ANIMATED ? undefined : FadeInDown.delay(i * step).duration(DURATION)}
    >
      {child}
    </Animated.View>
  ));
}
