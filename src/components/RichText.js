// Renderiza el formato liviano de src/lib/richtext.js: negrita, cursiva,
// subrayado, resaltado, color de texto, viñetas, listas numeradas ("N. ")
// y divisor ("---"). La forma de cada bloque la decide describeBlock
// (richhtml.js), la misma que usa el editor — así lo que se ve al estudiar
// es exactamente lo que se ve al editar.

import { useEffect, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { describeBlock } from "../lib/richhtml";
import { parseRich } from "../lib/richtext";
import { colors, radius, spacing, textColors } from "../theme";

// Imagen inline (data URI). Toma el aspect ratio real para no deformarla.
// width = % del ancho (100 = a todo lo ancho); se centra. Tocarla la abre a
// pantalla completa.
function ImageBlock({ src, width = 100 }) {
  const [ratio, setRatio] = useState(null);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let alive = true;
    Image.getSize(
      src,
      (w, h) => {
        if (alive && h) setRatio(w / h);
      },
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [src]);
  return (
    <View style={styles.imageWrap}>
      <Pressable onPress={() => setExpanded(true)} style={{ width: `${width}%` }}>
        <Image
          source={{ uri: src }}
          style={[styles.image, ratio ? { aspectRatio: ratio } : { height: 160 }]}
          resizeMode="contain"
        />
      </Pressable>
      <Modal
        visible={expanded}
        transparent
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.lightbox} onPress={() => setExpanded(false)}>
          <Image source={{ uri: src }} style={styles.lightboxImg} resizeMode="contain" />
        </Pressable>
      </Modal>
    </View>
  );
}

function spanStyle(span) {
  return [
    span.bold && styles.bold,
    span.italic && styles.italic,
    span.underline && styles.underline,
    span.highlight && styles.highlight,
    span.color && textColors[span.color] ? { color: textColors[span.color] } : null,
  ];
}

// defaultAlign: alineación de los bloques SIN alineación explícita (el default
// por cara — el dorso arranca centrado). Las listas nunca heredan el default
// (siempre a la izquierda).
export default function RichText({ text, style, containerStyle, defaultAlign = "left" }) {
  const blocks = parseRich(text).map(describeBlock);
  return (
    <View style={[styles.container, containerStyle]}>
      {blocks.map((block, i) => {
        if (block.kind === "hr") {
          return <View key={i} style={styles.divider} />;
        }

        if (block.kind === "img") {
          return <ImageBlock key={i} src={block.src} width={block.width} />;
        }

        const isList = block.kind === "li" || block.kind === "ol";
        // block.align: "left"/"center"/"right" explícito, o null ("sin tocar").
        // Sin tocar → las listas van a la izquierda; el resto usa el default de
        // la cara (frente = centro, dorso = izquierda).
        const align = block.align || (isList ? "left" : defaultAlign);

        const line = (
          <Text style={[style, align !== "left" && { textAlign: align }]} key={i}>
            {block.spans.map((span, j) => (
              <Text key={j} style={spanStyle(span)}>
                {span.text}
              </Text>
            ))}
          </Text>
        );

        if (block.kind === "li" || block.kind === "ol") {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={[style, styles.bullet]}>
                {block.kind === "ol" ? `${block.number}.` : "•"}
              </Text>
              {line}
            </View>
          );
        }
        return line;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  bold: { fontWeight: "700" },
  italic: { fontStyle: "italic" },
  underline: { textDecorationLine: "underline" },
  highlight: {
    backgroundColor: colors.highlight,
  },
  liRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  bullet: {
    marginTop: 1,
  },
  divider: {
    height: 1,
    alignSelf: "stretch",
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  imageWrap: {
    width: "100%",
    marginVertical: spacing.sm,
    alignItems: "center",
  },
  image: {
    width: "100%",
    borderRadius: radius.sm,
  },
  lightbox: {
    flex: 1,
    backgroundColor: "#000000EE",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  lightboxImg: {
    width: "100%",
    height: "100%",
  },
});
