// Bottom sheet reutilizable para menús contextuales y acciones ("...", "+").
// Funciona en nativo y web (react-native-web soporta Modal).

import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "../theme";

export default function ActionSheet({ visible, onClose, title, options = [], children }) {
  // El Modal de Android no se ajusta al teclado (adjustResize no aplica dentro
  // de Modals): subimos el sheet a mano con la altura reportada del teclado.
  // En web los listeners no disparan y kbHeight queda 0 — inofensivo.
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow",
      (e) => setKbHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide",
      () => setKbHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { marginBottom: kbHeight }]} onPress={() => {}}>
          <View style={styles.handle} />
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {options.map((opt) => (
            <Pressable
              key={opt.label}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
              onPress={() => {
                onClose();
                opt.onPress();
              }}
            >
              <Feather
                name={opt.icon}
                size={18}
                color={opt.destructive ? colors.danger : colors.text}
              />
              <Text style={[type.body, opt.destructive && { color: colors.danger }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#00000099",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  title: {
    ...type.heading,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 12,
  },
});
