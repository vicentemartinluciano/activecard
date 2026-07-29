// Luz que gira por el borde de una tarjeta, como el indicador de algo que está
// cargando. Se usa en el hero "Repaso de hoy".
//
// CÓMO FUNCIONA (no hay conic-gradient en React Native): debajo del contenido
// gira un cuadrado con un degradé lineal — de transparente a color y de vuelta
// — más grande que la tarjeta. El contenido, opaco y con su propio radio, tapa
// todo salvo una franja de `width` px en el borde: lo único que se ve del
// cuadrado girando es esa franja, y el haz parece recorrer el perímetro.
//
// El cuadrado tiene que medir la DIAGONAL de la tarjeta, si no al girar deja
// las esquinas sin cubrir.

import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View } from "react-native";

// react-native-web no tiene native driver: si se le pide, la animación no
// corre (el transform se queda en la identidad). En el teléfono sí conviene.
const NATIVE_DRIVER = Platform.OS !== "web";

const DURACION = 3600; // ms por vuelta
const ANCHO = 1.5; // grosor de la franja luminosa

export default function BorderLight({
  children,
  radius = 20,
  width = ANCHO,
  duration = DURACION,
  colors = ["transparent", "transparent", "rgba(77,124,255,0.95)", "rgba(0,242,254,0.6)", "transparent"],
  disabled = false,
  style,
}) {
  const spin = useRef(new Animated.Value(0)).current;
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

  const off = disabled || reduceMotion;

  useEffect(() => {
    if (off) return undefined;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: NATIVE_DRIVER,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [off, duration, spin]);

  return (
    <View style={[styles.outer, { borderRadius: radius, padding: width }, style]}>
      {!off ? (
        // Los insets negativos hacen que la capa sobre por todos lados: así al
        // girar sigue tapando las esquinas sin tener que medir la tarjeta
        // (medirla con onLayout resultó frágil — el estado llegaba en cero y la
        // capa nunca se dibujaba).
        <Animated.View
          pointerEvents="none"
          style={[
            styles.beam,
            {
              transform: [
                {
                  rotate: spin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={colors}
            locations={[0, 0.42, 0.5, 0.58, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}

      {/* El contenido va encima y tapa el centro: por eso la luz solo se ve en
          el borde. Su radio es el del contenedor menos el grosor de la franja. */}
      <View style={[styles.inner, { borderRadius: Math.max(0, radius - width) }]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    overflow: "hidden",
  },
  beam: {
    position: "absolute",
    // Sobra por los cuatro lados para cubrir las esquinas en cualquier ángulo.
    left: "-30%",
    right: "-30%",
    top: "-110%",
    bottom: "-110%",
  },
  inner: {
    overflow: "hidden",
  },
});
