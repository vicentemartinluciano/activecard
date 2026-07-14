// Primitivas de UI compartidas — mantienen la estética minimalista consistente.

import { Feather } from "@expo/vector-icons";
import { forwardRef, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing, type } from "../theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

// Contenedor de superficie en capas (patrón Quizlet): toda "card" visual de la
// app sale de acá para no duplicar estilos por pantalla.
// level: "base" (surfaceCard, contenedores principales) | "high" (surfaceHigh,
// sub-superficies dentro de otra card).
export function Card({ children, onPress, level = "base", style }) {
  const base = [styles.card, level === "high" && styles.cardHigh, style];
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.7 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

// Píldora semi-transparente para tags, contadores y badges.
export function Pill({ label, icon, color = colors.textMuted, onPress, style }) {
  const content = (
    <>
      {icon ? <Feather name={icon} size={12} color={color} /> : null}
      <Text style={[styles.pillLabel, { color }]}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }, style]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.pill, style]}>{content}</View>;
}

export function Button({ label, onPress, kind = "default", size = "md", disabled, style, labelStyle }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }).start();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        kind === "primary" && styles.buttonPrimary,
        kind === "danger" && styles.buttonDanger,
        kind === "ghost" && styles.buttonGhost,
        kind === "inverse" && styles.buttonInverse,
        size === "lg" && styles.buttonLg,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.85 },
        { transform: [{ scale }] },
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          kind === "primary" && { color: "#FFFFFF" },
          kind === "danger" && { color: colors.danger },
          kind === "ghost" && { color: colors.textMuted },
          kind === "inverse" && styles.buttonInverseLabel,
          size === "lg" && styles.buttonLgLabel,
          labelStyle,
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export const Field = forwardRef(function Field(
  { value, onChangeText, placeholder, multiline, style, ...rest },
  ref
) {
  return (
    <TextInput
      ref={ref}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      style={[styles.field, multiline && styles.fieldMultiline, style]}
      {...rest}
    />
  );
});

export function Chip({ label, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[styles.chipLabel, active && { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

// text: acepta \n para cortar en varias líneas. full: ocupa todo el alto
// disponible del padre (pantallas de estudio vacías); sin full, variante
// compacta para listas (Biblioteca).
export function EmptyState({ text, icon, full }) {
  return (
    <View style={[styles.empty, full && styles.emptyFull]}>
      {icon ? <Feather name={icon} size={48} color={colors.textMuted} style={{ opacity: 0.3 }} /> : null}
      <Text style={[type.small, styles.emptyText]}>{text}</Text>
    </View>
  );
}

// Confirmación que funciona en nativo (Alert) y en web (window.confirm).
export function confirmAsync(title, message) {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirmar", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

// Fila de entrada "texto + botón agregar" reutilizada en mazos y etiquetas.
export function InlineAdd({ placeholder, buttonLabel = "Agregar", onSubmit }) {
  const [text, setText] = useState("");
  const submit = () => {
    const clean = text.trim();
    if (!clean) return;
    onSubmit(clean);
    setText("");
  };
  return (
    <View style={styles.inlineAdd}>
      <Field
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        style={{ flex: 1 }}
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <Button label={buttonLabel} kind="primary" onPress={submit} disabled={!text.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  button: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
  },
  buttonDanger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonGhost: {
    backgroundColor: "transparent",
  },
  buttonInverse: {
    backgroundColor: "#FFFFFF",
  },
  buttonLg: {
    paddingVertical: 16,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  buttonInverseLabel: {
    color: colors.bg,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  buttonLgLabel: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  field: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm + 4,
    fontSize: 16,
  },
  fieldMultiline: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  cardHigh: {
    backgroundColor: colors.surfaceHigh,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignSelf: "flex-start",
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + 4,
    backgroundColor: colors.pillBg,
  },
  chipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  chipLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  emptyFull: {
    flex: 1,
    justifyContent: "center",
  },
  emptyText: {
    textAlign: "center",
    letterSpacing: 0.3,
    lineHeight: 20,
  },
  inlineAdd: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
