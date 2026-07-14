// Fuego de racha del header de Inicio — versión nativa (Android/iOS).
// Anima la animación Lottie del usuario cuando la racha está activa hoy.
// La versión web vive en StreakFlame.web.js (Metro resuelve por extensión de
// plataforma, así el bundle web nunca intenta cargar lottie-react-native).

import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

// ← si el fueguito sigue congelado en el device, poner false y mandar OTA
//   (activa la llama en código de abajo, sin Lottie).
const USE_LOTTIE = true;

const streakAnimation = require("../../assets/lottie/streak-fire.json");

// Plan B: llama animada en código (pulso de escala + parpadeo de opacidad
// desfasado + glow naranja) — no depende de lottie-react-native.
function CodeFlame() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.95, duration: 500, useNativeDriver: true }),
      ])
    );
    const flicker = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 350, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    );
    pulse.start();
    flicker.start();
    return () => {
      pulse.stop();
      flicker.stop();
    };
  }, [scale, opacity]);

  return (
    <View style={styles.flameBox}>
      <View style={styles.flameGlow} />
      <Animated.View style={{ transform: [{ scale }], opacity }}>
        <MaterialCommunityIcons name="fire" size={26} color={colors.streak} />
      </Animated.View>
    </View>
  );
}

export default function StreakFlame({ days = null, active = false }) {
  const color = active ? colors.streak : colors.textMuted;
  const size = 30;
  const animationRef = useRef(null);

  // autoPlay a veces se congela en el frame 0 en Android; forzar play() tras
  // el montado es el fix estándar para que la animación arranque de verdad.
  // F26 (rAF + play()) no alcanzó en el APK real → fix profundo: remount por
  // key, play() también desde onLayout del propio LottieView, y un reintento
  // diferido de seguridad además del rAF.
  useEffect(() => {
    if (!active || !USE_LOTTIE) return;
    const raf = requestAnimationFrame(() => animationRef.current?.play());
    const t = setTimeout(() => animationRef.current?.play(), 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [active]);

  return (
    <View style={styles.row}>
      {active && USE_LOTTIE ? (
        <LottieView
          key={active ? "flame-on" : "flame-off"}
          ref={animationRef}
          source={streakAnimation}
          autoPlay
          loop
          // Plan A del rediseño Neón: SOFTWARE evita el bug de composición
          // HARDWARE con ciertos JSON en Android (AUTOMATIC quedaba congelado).
          renderMode="SOFTWARE"
          onLayout={() => animationRef.current?.play()}
          style={{ width: size, height: size }}
        />
      ) : active ? (
        <CodeFlame />
      ) : (
        <MaterialCommunityIcons name="fire" size={26} color={color} />
      )}
      {days != null ? <Text style={[styles.days, { color }]}>{days}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  days: {
    fontSize: 17,
    fontWeight: "700",
  },
  flameBox: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  flameGlow: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    boxShadow: "0 0 10px rgba(247,107,21,0.55)",
  },
});
