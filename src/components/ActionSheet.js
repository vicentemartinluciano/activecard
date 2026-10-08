// Bottom sheet reutilizable para menús contextuales y acciones ("...", "+").
// Funciona en nativo y web (react-native-web soporta Modal).

import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "../theme";

export default function ActionSheet({ visible, onClose, title, options = [], children, anchorRef }) {
  const anchored = Platform.OS === 'web' && !!anchorRef;
  const [anchor, setAnchor] = useState(null);
  useEffect(() => {
    if (!visible || !anchored) return;
    const rect = anchorRef.current?.getBoundingClientRect?.();
    if (rect) setAnchor({ left: Math.max(12, Math.min(rect.left, window.innerWidth - 292)), bottom: Math.max(12, window.innerHeight - rect.top + 8) });
    const dismiss = (event) => { if (event.type === 'resize' || event.key === 'Escape') onClose(); };
    window.addEventListener('resize', dismiss);
    window.addEventListener('keydown', dismiss);
    return () => { window.removeEventListener('resize', dismiss); window.removeEventListener('keydown', dismiss); };
  }, [visible, anchored, anchorRef, onClose]);
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
      <Pressable style={[styles.backdrop, anchored && { backgroundColor: 'transparent', padding: 0 }]} onPress={onClose}>
        <Pressable accessibilityRole={anchored ? 'menu' : undefined} style={[styles.sheet, { marginBottom: kbHeight }, anchored && { position: 'absolute', width: 280, padding: 16, borderRadius: 16, backgroundColor: '#111217', boxShadow: '0 8px 28px rgba(0,0,0,0.45)', ...anchor }]} onPress={() => {}}>
          {!anchored && <View style={styles.handle} />}
          {title ? <Text style={[styles.title, anchored && { fontSize: 13, color: colors.textMuted, marginBottom: 4 }]}>{title}</Text> : null}
          {options.map((opt) => (
            <Pressable
              accessibilityRole={anchored ? 'menuitem' : 'button'}
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
    justifyContent: Platform.OS === 'web' ? "center" : "flex-end",
    ...(Platform.OS === 'web' ? { padding: spacing.md } : {}),
  },
  sheet: {
    backgroundColor: colors.surfaceCard,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    ...(Platform.OS === 'web' ? { borderRadius: radius.lg } : {}),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    gap: spacing.sm,
    width: "100%",
    // A propósito NO usa layout.maxWidth: en web ese token vale 840 y un bottom
    // sheet tan ancho se ve mal. El sheet se queda angosto en todos lados.
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
