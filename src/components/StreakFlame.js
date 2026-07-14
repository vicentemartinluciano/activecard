// Fuego de racha del header de Inicio — versión nativa (Android/iOS).
// Anima la animación Lottie del usuario cuando la racha está activa hoy.
// La versión web vive en StreakFlame.web.js (Metro resuelve por extensión de
// plataforma, así el bundle web nunca intenta cargar lottie-react-native).

import { MaterialCommunityIcons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

const streakAnimation = require("../../assets/lottie/streak-fire.json");

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
    if (!active) return;
    const raf = requestAnimationFrame(() => animationRef.current?.play());
    const t = setTimeout(() => animationRef.current?.play(), 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [active]);

  return (
    <View style={styles.row}>
      {active ? (
        <LottieView
          key={active ? "flame-on" : "flame-off"}
          ref={animationRef}
          source={streakAnimation}
          autoPlay
          loop
          // Si en el device sigue congelado pese a todo lo anterior, el
          // fallback conocido es renderMode="SOFTWARE" (bug de composición
          // HARDWARE con ciertos JSON en Android).
          renderMode="AUTOMATIC"
          onLayout={() => animationRef.current?.play()}
          style={{ width: size, height: size }}
        />
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
});
