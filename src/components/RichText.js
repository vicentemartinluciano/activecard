// Renderiza el formato liviano de src/lib/richtext.js: negrita, cursiva,
// subrayado, resaltado, color de texto, viñetas, listas numeradas ("N. ")
// y divisor ("---"). La forma de cada bloque la decide describeBlock
// (richhtml.js), la misma que usa el editor — así lo que se ve al estudiar
// es exactamente lo que se ve al editar.

import { StyleSheet, Text, View } from "react-native";

import { describeBlock } from "../lib/richhtml";
import { parseRich } from "../lib/richtext";
import { colors, spacing, textColors } from "../theme";

function spanStyle(span) {
  return [
    span.bold && styles.bold,
    span.italic && styles.italic,
    span.underline && styles.underline,
    span.highlight && styles.highlight,
    span.color && textColors[span.color] ? { color: textColors[span.color] } : null,
  ];
}

export default function RichText({ text, style, containerStyle }) {
  const blocks = parseRich(text).map(describeBlock);
  return (
    <View style={[styles.container, containerStyle]}>
      {blocks.map((block, i) => {
        if (block.kind === "hr") {
          return <View key={i} style={styles.divider} />;
        }

        const line = (
          <Text
            style={[style, block.align && block.align !== "left" && { textAlign: block.align }]}
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
});
