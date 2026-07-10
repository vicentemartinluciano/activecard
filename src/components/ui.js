// Primitivas de UI compartidas — mantienen la estética minimalista consistente.

import { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing, type } from "../theme";

export function Screen({ children, style }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Button({ label, onPress, kind = "default", disabled, style }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        kind === "primary" && styles.buttonPrimary,
        kind === "danger" && styles.buttonDanger,
        kind === "ghost" && styles.buttonGhost,
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.7 },
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          kind === "primary" && { color: colors.accent },
          kind === "danger" && { color: colors.danger },
          kind === "ghost" && { color: colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({ value, onChangeText, placeholder, multiline, style, ...rest }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textMuted}
      multiline={multiline}
      style={[styles.field, multiline && styles.fieldMultiline, style]}
      {...rest}
    />
  );
}

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

export function EmptyState({ text }) {
  return (
    <View style={styles.empty}>
      <Text style={type.small}>{text}</Text>
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
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPrimary: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  buttonDanger: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  buttonGhost: {
    backgroundColor: "transparent",
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
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
  chip: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm + 4,
    backgroundColor: colors.surface,
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
  },
  inlineAdd: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
