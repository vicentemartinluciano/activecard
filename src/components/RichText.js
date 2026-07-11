// Renderiza el formato liviano de src/lib/richtext.js: negrita, cursiva,
// subrayado, resaltado, color de texto y listas con viñetas.

import { StyleSheet, Text, View } from "react-native";

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
  const blocks = parseRich(text);
  return (
    <View style={[styles.container, containerStyle]}>
      {blocks.map((block, i) => {
        const line = (
          <Text style={style} key={i}>
            {block.spans.map((span, j) => (
              <Text key={j} style={spanStyle(span)}>
                {span.text}
              </Text>
            ))}
          </Text>
        );
        if (block.type === "li") {
          return (
            <View key={i} style={styles.liRow}>
              <Text style={[style, styles.bullet]}>•</Text>
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
});
