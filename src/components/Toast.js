// Aviso breve abajo de la pantalla. Existe porque hasta ahora varios fallos
// morían en un `.catch(() => setEstado(null))`: la pantalla quedaba vacía y no
// había forma de saber que algo había salido mal, ni de reintentar.
//
// Se usa vía el hook useToast() de un contenedor, o montando <Toast/> suelto.

import { Feather } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text } from "react-native";

import { colors, font, radius, spacing, type } from "../theme";

const DURACION = 5000;

export default function Toast({ message, tone = "error", onRetry, onDismiss }) {
  const y = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return undefined;
    Animated.parallel([
      Animated.timing(y, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    // Los avisos con acción no se van solos: si ofrecemos "Reintentar", el
    // usuario tiene que llegar a tocarlo.
    if (onRetry) return undefined;
    const t = setTimeout(() => onDismiss && onDismiss(), DURACION);
    return () => clearTimeout(t);
  }, [message, onRetry, onDismiss, y, opacity]);

  if (!message) return null;

  const esError = tone === "error";

  return (
    <Animated.View
      style={[
        styles.wrap,
        esError ? styles.error : styles.ok,
        { opacity, transform: [{ translateY: y }] },
      ]}
    >
      <Feather
        name={esError ? "alert-triangle" : "check-circle"}
        size={16}
        color={esError ? "#FFC9CB" : colors.successBright}
      />
      <Text style={[styles.text, esError && { color: "#FFC9CB" }]}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} hitSlop={8}>
          <Text style={styles.action}>Reintentar</Text>
        </Pressable>
      ) : (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Feather name="x" size={15} color={colors.textMuted} />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: Platform.OS === "web" ? spacing.lg : spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    zIndex: 50,
  },
  error: {
    backgroundColor: "#2A1416",
    borderColor: "rgba(229,72,77,0.35)",
  },
  ok: {
    backgroundColor: colors.surfaceHigh,
    borderColor: colors.cardBorder,
  },
  text: {
    ...type.small,
    color: colors.text,
    flex: 1,
    lineHeight: 18,
  },
  action: {
    ...type.small,
    ...font(700),
    color: colors.accentText,
  },
});
