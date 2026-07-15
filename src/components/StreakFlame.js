// Fuego de racha del header de Inicio — versión nativa (Android/iOS).
// Anima la animación Lottie del usuario cuando la racha está activa hoy.
// La versión web vive en StreakFlame.web.js (Metro resuelve por extensión de
// plataforma, así el bundle web nunca intenta cargar lottie-react-native).

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useIsFocused } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { colors } from "../theme";

// true = Lottie animado por `progress` (F61). Su loop corre por JS
// (useNativeDriver false) pero está gateado por useIsFocused: solo anima con
// Inicio en primer plano. Martín pidió volver al Lottie (2026-07-15); si el
// repaso vuelve a sentirse lento, el primer sospechoso sigue siendo este loop
// → flip a false (llama en código, native driver).
const USE_LOTTIE = true;

const streakAnimation = require("../../assets/lottie/streak-fire.json");
const LOOP_MS = 3036; // 91 frames @ 29.97 fps = un ciclo completo del fuego

// Fix portado de FlowState (Fuego.js): el autoPlay/ValueAnimator interno de
// Lottie se queda en el primer frame en Android (Fabric / escala de animación
// del sistema baja). Reproducimos por `progress` con un Animated.loop — el
// mismo motor que SÍ anima en el device — así el fuego avanza siempre.
// El wrap con createAnimatedComponent es obligatorio: pasarle el
// Animated.Value crudo al componente nativo crashea el puente al montar.
const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

function LottieFlame({ size }) {
  const progress = useRef(new Animated.Value(0)).current;
  // El loop corre por JS (useNativeDriver false, como en FlowState): frenarlo
  // cuando la pantalla pierde el foco — la Home queda montada debajo del
  // repaso (tabs) y el loop de fondo congestionaba el hilo JS (flips lentos).
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return undefined;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: LOOP_MS,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress, focused]);
  return (
    <AnimatedLottieView
      source={streakAnimation}
      progress={progress}
      resizeMode="contain"
      renderMode="HARDWARE"
      style={{ width: size, height: size }}
    />
  );
}

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

  return (
    <View style={styles.row}>
      {active && USE_LOTTIE ? (
        <LottieFlame size={30} />
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
