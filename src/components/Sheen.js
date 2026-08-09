// Reflejo que barre la superficie en diagonal, lento y continuo. Reemplaza al
// BorderBeam (la luz que recorría el contorno, "efecto lombriz"): esa se leía
// inquieta y este brillo pasa por encima sin pedir atención.
//
// Decorativo puro: se dibuja con absoluteFill + pointerEvents none y no envuelve
// nada, así que el consumidor lo mete como primer hijo de la superficie a
// iluminar (esa superficie ya recorta con su propio overflow hidden).

import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { layout } from "../theme";

const CICLO = 7000; // ms por barrido — lento a propósito
const ANCHO_RATIO = 0.5; // la banda mide la mitad del ancho del contenedor
const INCLINACION = 18; // grados

export default function Sheen({ disabled = false, radius = 0 }) {
  const { width: anchoVentana } = useWindowDimensions();
  // Arranca con una estimación y `onLayout` la corrige. El fallback NO es
  // opcional: hay entornos donde el ResizeObserver detrás de onLayout no emite
  // (el navegador embebido del preview corre a 0 fps), y sin él el reflejo
  // quedaba invisible para siempre en vez de solo mal medido.
  const [ancho, setAncho] = useState(Math.min(anchoVentana, layout.maxWidth));
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (disabled || !ancho) {
      progress.setValue(0);
      return undefined;
    }
    // Native driver SOLO en nativo: react-native-web no lo soporta y pedirlo
    // deja la animación quieta (misma trampa que Stagger y StreakFlame).
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: CICLO,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      })
    );
    loop.start();
    return () => loop.stop();
  }, [disabled, ancho, progress]);

  const banda = Math.max(1, ancho * ANCHO_RATIO);
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-banda, ancho + banda],
  });

  // MISMO reflejo en las dos plataformas, con la transformación que cada una
  // respeta: en web el `skewX` de siempre; en Android `skewX` se ignora (el
  // reflejo se veía recto, sin inclinar) y la rotación sí se aplica. Para una
  // banda cuyas puntas quedan fuera del recorte, inclinar por corte o por giro
  // se ve igual.
  const inclinar =
    Platform.OS === "web" ? { skewX: `${INCLINACION}deg` } : { rotate: `${INCLINACION}deg` };

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) setAncho(w);
      }}
    >
      {ancho > 0 ? (
        <Animated.View
          // El alto de más deja que la banda inclinada cubra las esquinas: sin
          // eso la inclinación deja dos triángulos apagados arriba y abajo. Con
          // el giro (nativo) hace falta más aire que con el corte: sobra invisible
          // porque el contenedor recorta.
          style={{
            position: "absolute",
            top: -160,
            bottom: -160,
            width: banda,
            transform: [{ translateX }, inclinar],
          }}
        >
          <LinearGradient
            colors={[
              "rgba(146,175,255,0)",
              "rgba(146,175,255,0.09)",
              "rgba(200,220,255,0.16)",
              "rgba(146,175,255,0.09)",
              "rgba(146,175,255,0)",
            ]}
            locations={[0, 0.38, 0.5, 0.62, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
