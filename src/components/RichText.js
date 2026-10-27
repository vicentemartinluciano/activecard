// Renderiza el formato liviano de src/lib/richtext.js: negrita, cursiva,
// subrayado, resaltado, color de texto, viñetas, listas numeradas ("N. ")
// y divisor ("---"). La forma de cada bloque la decide describeBlock
// (richhtml.js), la misma que usa el editor — así lo que se ve al estudiar
// es exactamente lo que se ve al editar.

import { useContext, useEffect, useMemo, useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { describeBlock, groupQuoteRuns } from "../lib/richhtml";
import { tableGrid, tableColumnWidths } from "../lib/richTable";
import { parseRich } from "../lib/richtext";
import { colors, font, radius, spacing, textColors } from "../theme";
import { StudyInteractionContext } from "./StudyInteractionContext";
import RichToggle from "./RichToggle";

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

function TableBlock({ rows, style }) {
  const interactionRef = useContext(StudyInteractionContext);
  const [measured, setMeasured] = useState({});
  const [width, setWidth] = useState(0);
  const { cells, columns } = useMemo(() => tableGrid(rows), [rows]);
  const minColumnWidth = Platform.OS === "web" ? 80 : 200;
  const columnWidth = Math.max(200, width / Math.max(1, columns));
  const widths = tableColumnWidths(rows, columnWidth, minColumnWidth);
  const columnOffset = (column) => widths.slice(0, column).reduce((sum, value) => sum + value, 0);
  const heights = rows.map(() => 48);
  cells.forEach((cell, index) => {
    const height = (measured[index] || 48) / cell.rowspan;
    for (let r = cell.row; r < cell.row + cell.rowspan; r++) heights[r] = Math.max(heights[r], height);
  });
  const offset = (row) => heights.slice(0, row).reduce((sum, height) => sum + height, 0);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ marginVertical: 12 }}>
      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator dataSet={{ studyAction: "table" }}
        onTouchStart={() => { if (interactionRef) { interactionRef.current = true; interactionRef.suppressFlipUntil = Date.now() + 400; } }}
        onTouchEnd={() => { if (interactionRef) { interactionRef.current = false; interactionRef.suppressFlipUntil = Date.now() + 400; } }}
        onTouchCancel={() => { if (interactionRef) { interactionRef.current = false; interactionRef.suppressFlipUntil = Date.now() + 400; } }}>
        <View style={{ width: columnOffset(columns), height: offset(rows.length) }}>
          {cells.map((cell, index) => (
            <View
              key={index}
              style={{
                position: "absolute",
                left: columnOffset(cell.column),
                top: offset(cell.row),
                width: columnOffset(cell.column + cell.colspan) - columnOffset(cell.column),
                height: offset(cell.row + cell.rowspan) - offset(cell.row),
                borderWidth: 0.5,
                borderColor: colors.border,
                backgroundColor: cell.header ? colors.surfaceHigh : "transparent",
              }}
            >
              <View
                onLayout={(event) => {
                  const height = Math.ceil(event.nativeEvent.layout.height) + 2;
                  setMeasured((previous) => (previous[index] === height ? previous : { ...previous, [index]: height }));
                }}
                style={{ padding: 10 }}
              >
                <RichText text={cell.text} style={[style, cell.header && styles.bold]} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
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
  const baseSize = StyleSheet.flatten(style)?.fontSize || 16;
  const blocks = useMemo(() => groupQuoteRuns(parseRich(text).map(describeBlock)), [text]);
  return (
    <View style={[styles.container, containerStyle]}>
      {blocks.map((block, i) => {
        if (block.kind === "toggle") return (
          <RichToggle key={`${i}:${block.summary}`} title={<RichText text={block.summary || "Desplegable"} style={style} />}>
            <RichText text={block.content} style={style} defaultAlign={defaultAlign} />
          </RichToggle>
        );
        if (block.kind === "table") return <TableBlock key={i} rows={block.rows} style={style} />;
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
                    {quote.spans.length === 0 ? "\u00a0" : quote.spans.map((span, k) => (
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
        const headingScale = { heading1: 1.55, heading2: 1.3, heading3: 1.12 }[block.kind];
        const blockTextStyle = headingScale
          ? { ...font(700), fontSize: baseSize * headingScale, lineHeight: baseSize * headingScale * 1.22, marginVertical: 4 }
          : { marginBottom: 2 };


        const line = (
          <Text
            style={[style, blockTextStyle, align !== "left" && { textAlign: align }, isList && styles.liContent]}
            key={i}
          >
            {block.spans.length === 0 ? "\u00a0" : block.spans.map((span, j) => (
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
  quoteWrap: { borderLeftWidth: 3, borderLeftColor: "#5B6897", paddingLeft: 12, paddingVertical: 3, marginVertical: 5 },
  quoteText: { color: colors.textMuted, marginBottom: 2 },
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
