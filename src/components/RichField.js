// Editor de texto con formato liviano tipo Notion: al seleccionar texto
// aparece una barrita de botones (negrita, cursiva, subrayado, resaltado,
// color, lista). Envuelve el Field de siempre — sin dependencias nuevas.

import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { toggleListLines, wrapColor, wrapSelection } from "../lib/richtext";
import { colors, radius, spacing, textColors } from "../theme";
import { Field } from "./ui";
import RichText from "./RichText";

const MARK_BUTTONS = [
  { label: "N", marker: "**", key: "bold", style: { fontWeight: "700" } },
  { label: "I", marker: "*", key: "italic", style: { fontStyle: "italic" } },
  { label: "S", marker: "__", key: "underline", style: { textDecorationLine: "underline" } },
  { label: "◆", marker: "==", key: "highlight" },
];

export default function RichField({ value, onChangeText, placeholder, style }) {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [showColors, setShowColors] = useState(false);
  const inputRef = useRef(null);

  // Fallback web: onSelectionChange de RN Web depende del evento nativo
  // 'select' del <textarea>, que algunos navegadores/entornos no disparan
  // para selección por teclado o arrastre. 'selectionchange' a nivel
  // documento es más confiable — lo escuchamos y filtramos por si el campo
  // enfocado es este.
  useEffect(() => {
    if (Platform.OS !== "web") return undefined;
    const handler = () => {
      const node = inputRef.current;
      if (!node || document.activeElement !== node) return;
      const start = node.selectionStart;
      const end = node.selectionEnd;
      if (typeof start === "number" && typeof end === "number") {
        setSelection((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  const hasSelection = selection.end > selection.start;

  const applyMark = (marker) => {
    const { text, start, end } = wrapSelection(value, selection.start, selection.end, marker);
    onChangeText(text);
    setSelection({ start, end });
    setShowColors(false);
  };

  const applyColor = (colorKey) => {
    const { text, start, end } = wrapColor(value, selection.start, selection.end, colorKey);
    onChangeText(text);
    setSelection({ start, end });
    setShowColors(false);
  };

  const applyList = () => {
    onChangeText(toggleListLines(value, selection.start, selection.end));
    setShowColors(false);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {hasSelection ? (
        <View style={styles.toolbar}>
          {MARK_BUTTONS.map((b) => (
            <Pressable
              key={b.key}
              onPress={() => applyMark(b.marker)}
              style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={[styles.toolBtnLabel, b.style]}>{b.label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setShowColors((s) => !s)}
            style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.toolBtnLabel}>A</Text>
          </Pressable>
          <Pressable
            onPress={applyList}
            style={({ pressed }) => [styles.toolBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.toolBtnLabel}>•</Text>
          </Pressable>
        </View>
      ) : null}

      {hasSelection && showColors ? (
        <View style={styles.toolbar}>
          {Object.entries(textColors).map(([key, hex]) => (
            <Pressable
              key={key}
              onPress={() => applyColor(key)}
              style={({ pressed }) => [styles.swatch, { backgroundColor: hex }, pressed && { opacity: 0.6 }]}
            />
          ))}
        </View>
      ) : null}

      <Field
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        placeholder={placeholder}
        multiline
        style={style}
      />

      {value && value.trim() ? (
        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Vista previa</Text>
          <RichText text={value} style={styles.previewText} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    gap: spacing.xs,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radius.sm,
    padding: spacing.xs,
    alignSelf: "flex-start",
  },
  toolBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  toolBtnLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  previewLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  previewText: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 22,
  },
});
