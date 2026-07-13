// Editor de texto con formato liviano tipo Notion, SIN vista previa aparte:
// el campo es el único elemento y las marcas (**, [[azul:, etc.) quedan
// invisibles mientras se escribe.
//
// Cómo funciona: el TextInput muestra el "display" (el texto fuente sin
// marcadores, vía buildEditMap) con color transparente, y una capa fantasma
// detrás renderiza EXACTAMENTE los mismos caracteres con los estilos de cada
// tramo — como ambas capas comparten tipografía y padding, el caret nativo
// cae sobre el glifo estilizado. Las ediciones del display se traducen al
// string fuente con diffDisplays + editSource, así el padre sigue guardando
// el markup de siempre (contrato value/onChangeText intacto).
//
// Clave: aplicar/quitar formato NO cambia el display (los marcadores son
// invisibles), así que el caret no salta ni se pierde el foco. Solo la lista
// ("- " es texto visible) o el colapso de un marcador tipeado a mano mutan
// el display; ahí se repone la selección por un único render (forcedSelection).

import { Feather } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import {
  buildEditMap,
  diffDisplays,
  displayToSource,
  editSource,
  getActiveMarks,
  setColor,
  toggleListLines,
  toggleMark,
} from "../lib/richtext";
import { colors, radius, spacing, textColors } from "../theme";
import { Field } from "./ui";

const MARK_BUTTONS = [
  { key: "bold", icon: "bold", marker: "**" },
  { key: "italic", icon: "italic", marker: "*" },
  { key: "underline", icon: "underline", marker: "__" },
  { key: "highlight", icon: "edit-3", marker: "==" },
];

const MIN_HEIGHT = 100;

// Estilo visual de un tramo en la capa fantasma. La negrita se simula con
// textShadow (mismas métricas que el texto normal: si usáramos fontWeight
// real, los glifos más anchos desalinearían el caret del input de arriba).
function ghostSpanStyle(styles) {
  const s = [];
  const color = styles.color && textColors[styles.color] ? textColors[styles.color] : colors.text;
  s.push({ color });
  if (styles.bold) {
    s.push({ textShadowColor: color, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0.9 });
  }
  if (styles.italic) s.push({ fontStyle: "italic" });
  if (styles.underline) s.push({ textDecorationLine: "underline" });
  if (styles.highlight) s.push({ backgroundColor: colors.highlight });
  return s;
}

function ToolButton({ icon, active, onPress, testID }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      testID={testID}
      style={({ pressed }) => [styles.toolBtn, active && styles.toolBtnActive, pressed && { opacity: 0.6 }]}
    >
      <Feather name={icon} size={15} color={active ? colors.accentText : colors.text} />
    </Pressable>
  );
}

// Dónde debería quedar el caret cuando el display re-generado difiere de lo
// que el usuario acaba de escribir (colapso de un marcador tipeado a mano).
function reconcileCaret(typedDisplay, nextDisplay, typedCaret) {
  const diff = diffDisplays(typedDisplay, nextDisplay);
  if (typedCaret <= diff.dStart) return typedCaret;
  return Math.min(diff.dStart + diff.inserted.length, nextDisplay.length);
}

export default function RichField({ value, onChangeText, placeholder, style }) {
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState(null);
  const [showColors, setShowColors] = useState(false);
  const inputRef = useRef(null);

  const source = value == null ? "" : String(value);
  const map = useMemo(() => buildEditMap(source), [source]);

  // La selección controlada solo se fuerza durante UN render (los inputs de
  // Android se portan mal con selection permanente); acá se suelta.
  useEffect(() => {
    if (!forcedSelection) return undefined;
    const t = setTimeout(() => setForcedSelection(null), 50);
    return () => clearTimeout(t);
  }, [forcedSelection]);

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

  // Selección en coordenadas del source: right/left en los bordes hace que
  // seleccionar `texto` dentro de **texto** caiga en el inner del run (así
  // toggleMark/getActiveMarks detectan la marca envolvente).
  const sStart = displayToSource(map, Math.min(selection.start, map.display.length), "right");
  const sEnd = displayToSource(map, Math.min(selection.end, map.display.length), "left");
  const active = useMemo(
    () => (hasSelection ? getActiveMarks(source, sStart, sEnd) : null),
    [hasSelection, source, sStart, sEnd]
  );

  const handleDisplayChange = (nextDisplay) => {
    if (nextDisplay === map.display) return;
    const diff = diffDisplays(map.display, nextDisplay);
    const nextSource = editSource(source, diff.dStart, diff.dEnd, diff.inserted);
    const regenerated = buildEditMap(nextSource).display;
    if (regenerated !== nextDisplay) {
      const caret = reconcileCaret(nextDisplay, regenerated, diff.dStart + diff.inserted.length);
      setSelection({ start: caret, end: caret });
      setForcedSelection({ start: caret, end: caret });
    }
    onChangeText(nextSource);
  };

  // Aplicar formato no cambia el display (los marcadores son invisibles):
  // el input conserva texto, caret y foco; solo cambia el source del padre.
  const applyMark = (marker) => {
    if (sEnd <= sStart) return;
    const res = toggleMark(source, sStart, sEnd, marker);
    onChangeText(res.text);
    setShowColors(false);
    inputRef.current?.focus();
  };

  const applyColor = (colorKey) => {
    if (sEnd <= sStart) return;
    const res = setColor(source, sStart, sEnd, colorKey);
    onChangeText(res.text);
    setShowColors(false);
    inputRef.current?.focus();
  };

  const applyList = () => {
    const wasList = getActiveMarks(source, sStart, sEnd).list;
    const next = toggleListLines(source, sStart, sEnd);
    // El "- " es texto visible: el display cambia y hay que correr la
    // selección lo que se corrió cada línea tocada.
    const delta = wasList ? -2 : 2;
    const displayLines = [];
    let pos = 0;
    for (const line of map.display.split("\n")) {
      displayLines.push({ start: pos, end: pos + line.length });
      pos += line.length + 1;
    }
    const touched = displayLines.filter((l) => l.end >= selection.start && l.start <= selection.end);
    const shift = (d) => {
      let out = d;
      for (const l of touched) {
        if (l.start <= d) out = Math.max(l.start, out + delta);
      }
      return Math.max(0, out);
    };
    const nextSel = { start: shift(selection.start), end: shift(selection.end) };
    onChangeText(next);
    setSelection(nextSel);
    setForcedSelection(nextSel);
    setShowColors(false);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.root}>
      {hasSelection ? (
        <View style={[styles.toolbar, Platform.OS === "web" && styles.toolbarWebBlur]}>
          <View style={styles.toolbarRow}>
            {MARK_BUTTONS.map((b) => (
              <ToolButton
                key={b.key}
                icon={b.icon}
                testID={`rich-${b.key}`}
                active={Boolean(active && active[b.key])}
                onPress={() => applyMark(b.marker)}
              />
            ))}
            <View style={styles.toolDivider} />
            <ToolButton icon="droplet" testID="rich-colors" active={Boolean(active && active.color) || showColors} onPress={() => setShowColors((s) => !s)} />
            <ToolButton icon="list" testID="rich-list" active={Boolean(active && active.list)} onPress={applyList} />
          </View>
          {showColors ? (
            <View style={styles.toolbarRow}>
              {Object.entries(textColors).map(([key, hex]) => (
                <Pressable
                  key={key}
                  onPress={() => applyColor(key)}
                  hitSlop={6}
                  testID={`rich-color-${key}`}
                  style={({ pressed }) => [
                    styles.swatch,
                    { backgroundColor: hex },
                    active && active.color === key && styles.swatchActive,
                    pressed && { opacity: 0.6 },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.editorShell}>
        {/* La capa fantasma va en el flujo: además de mostrar el texto
            estilizado, define el alto del campo (auto-grow sin JS). El
            zero-width space final hace que un \n de cierre también sume
            una línea al alto. */}
        <View pointerEvents="none" style={styles.ghost} testID="rich-ghost">
          <Text style={styles.ghostText}>
            {map.segments.map((seg, i) => (
              <Text key={i} style={ghostSpanStyle(seg.styles)}>
                {map.display.slice(seg.dStart, seg.dEnd)}
              </Text>
            ))}
            {"​"}
          </Text>
        </View>
        <Field
          ref={inputRef}
          testID="rich-input"
          value={map.display}
          onChangeText={handleDisplayChange}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          placeholder={placeholder}
          multiline
          scrollEnabled={false}
          selection={forcedSelection || undefined}
          selectionColor={colors.accent}
          cursorColor={colors.text}
          style={[styles.input, style, styles.inputOverrides]}
        />
      </View>
    </View>
  );
}

// La capa fantasma y el input DEBEN compartir métricas exactas (tipografía,
// line height, padding + borde del Field) para que el caret calce sobre el
// texto estilizado. Si se cambia styles.field en ui.js, recalibrar acá.
const typography = {
  fontSize: 16,
  lineHeight: 22,
  ...(Platform.OS === "android" ? { includeFontPadding: false } : null),
  ...(Platform.OS === "web" ? { whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" } : null),
};

const styles = StyleSheet.create({
  root: {
    position: "relative",
  },
  // Solapa el borde superior del propio campo (en vez de flotar por
  // completo arriba de él): si flotara totalmente afuera, un ScrollView
  // que envuelve el campo (como en la pantalla de editor de tarjeta) lo
  // recorta cuando el campo está pegado al borde superior visible.
  toolbar: {
    position: "absolute",
    top: -8,
    left: 6,
    zIndex: 30,
    gap: spacing.xs,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: radius.lg,
    backgroundColor: "#1C1C22F0",
    borderWidth: 1,
    borderColor: colors.pillBorder,
    ...(Platform.OS === "web"
      ? { boxShadow: "0 6px 14px rgba(0, 0, 0, 0.4)" }
      : {
          shadowColor: "#000000",
          shadowOpacity: 0.4,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }),
  },
  toolbarWebBlur: {
    backgroundColor: "#1C1C22CC",
    backdropFilter: "blur(20px)",
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  toolBtn: {
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnActive: {
    backgroundColor: colors.accentSoft,
  },
  toolDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 4,
    backgroundColor: colors.pillBorder,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.pillBorder,
  },
  swatchActive: {
    borderWidth: 2,
    borderColor: colors.text,
  },
  // El fondo del campo vive en el shell; la capa fantasma (en el flujo)
  // define el alto y el input transparente flota encima ocupándolo todo.
  editorShell: {
    position: "relative",
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
  },
  ghost: {
    minHeight: MIN_HEIGHT,
    paddingVertical: 11,
    paddingHorizontal: spacing.sm + 5,
  },
  ghostText: {
    ...typography,
    color: colors.text,
  },
  input: {
    ...StyleSheet.absoluteFillObject,
    ...typography,
    textAlignVertical: "top",
  },
  inputOverrides: {
    color: "transparent",
    backgroundColor: "transparent",
    ...(Platform.OS === "web" ? { caretColor: colors.text } : null),
  },
});
