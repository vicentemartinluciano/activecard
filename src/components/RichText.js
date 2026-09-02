// Renderiza el formato liviano de src/lib/richtext.js: negrita, cursiva,
// subrayado, resaltado, color de texto, viñetas, listas numeradas ("N. ")
// y divisor ("---"). La forma de cada bloque la decide describeBlock
// (richhtml.js), la misma que usa el editor — así lo que se ve al estudiar
// es exactamente lo que se ve al editar.

import { useEffect, useMemo, useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { describeBlock, groupQuoteRuns } from "../lib/richhtml";
import { parseRich } from "../lib/richtext";
import { colors, font, radius, spacing, textColors } from "../theme";

// Imagen inline (data URI). Toma el aspect ratio real para no deformarla y
// respetar el ancho elegido. width = % del ancho (100 = a todo lo ancho); se
// centra. Tocarla la abre a pantalla completa.
// La proporción se saca del evento onLoad de la <Image> (funciona con data URIs
// base64 en Android, donde Image.getSize FALLA); getSize queda como camino extra
// para la web. Sin proporción, si cayera a una altura fija, el ancho no se
// notaría — por eso onLoad es clave en el celu.
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
          onLoad={(e) => {
            const s = e?.nativeEvent?.source;
            if (s && s.height) setRatio(s.width / s.height);
          }}
          style={[styles.image, { aspectRatio: ratio || 1 }]}
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
    span.underline && span.strike ? styles.underlineStrike : span.underline && styles.underline,
    span.strike && !span.underline && styles.strike,
    span.highlight && styles.highlight,
    span.color && textColors[span.color] ? { color: textColors[span.color] } : null,
  ];
}

// defaultAlign: alineación de los bloques SIN alineación explícita (el default
// por cara — el dorso arranca centrado). Las listas nunca heredan el default
// (siempre a la izquierda).
export default function RichText({ text, style, containerStyle, defaultAlign = "left" }) {
  const blocks = useMemo(() => groupQuoteRuns(parseRich(text).map(describeBlock)), [text]);
  return (
    <View style={[styles.container, containerStyle]}>
      {blocks.map((block, i) => {
        if (block.kind === "quoteGroup") {
          return (
            <View key={i} style={styles.quoteWrap}>
              {block.blocks.map((quote, j) => {
                const align = quote.align || defaultAlign;
                return (
                  <Text
                    key={j}
                    style={[style, styles.quoteText, align !== "left" && { textAlign: align }]}
                  >
                    {quote.spans.map((span, k) => (
                      <Text key={k} style={spanStyle(span)}>
                        {span.text}
                      </Text>
                    ))}
                  </Text>
                );
              })}
            </View>
          );
        }

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
        const blockTextStyle = block.kind === "heading1" ? styles.heading1
          : block.kind === "heading2" ? styles.heading2
            : block.kind === "heading3" ? styles.heading3
              : null;

        const line = (
          <Text
            style={[style, blockTextStyle, align !== "left" && { textAlign: align }, isList && styles.liContent]}
            key={i}
          >
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
  bold: { ...font(700) },
  italic: { fontStyle: "italic" },
  underline: { textDecorationLine: "underline" },
  strike: { textDecorationLine: "line-through" },
  underlineStrike: { textDecorationLine: "underline line-through" },
  highlight: {
    backgroundColor: colors.highlight,
  },
  liRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  // El contenido de la lista ocupa el ancho restante de la fila y ENVUELVE
  // (sin flex, un Text en una row se desborda y se recorta a la derecha).
  liContent: {
    flex: 1,
  },
  bullet: {
    marginTop: 1,
  },
  heading1: { ...font(700), fontSize: 24, lineHeight: 30, marginVertical: 3 },
  heading2: { ...font(700), fontSize: 20, lineHeight: 26, marginVertical: 2 },
  heading3: { ...font(700), fontSize: 17, lineHeight: 23, marginVertical: 1 },
  quoteWrap: { borderLeftWidth: 3, borderLeftColor: "#5B6897", paddingLeft: spacing.sm, marginVertical: spacing.xs },
  quoteText: { color: colors.textMuted, fontStyle: "italic" },
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
