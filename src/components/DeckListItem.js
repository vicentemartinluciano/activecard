// Fila de mazo estilo Quizlet: ícono, nombre, píldoras (tarjetas, tags,
// prioridad) y barra de progreso diario. Compartida entre la Biblioteca y la
// pantalla de carpeta.

import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import ProgressBar from "./ProgressBar";
import { Card, Pill } from "./ui";
import { colors, gradients, radius, spacing, type } from "../theme";

export default function DeckListItem({ deck, progress, onPress }) {
  return (
    <Card onPress={onPress}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Feather name={deck.icon || "book"} size={20} color={colors.accentText} />
        </View>
        <Text style={styles.name} numberOfLines={2}>
          {deck.name}
        </Text>
      </View>
      <View style={styles.pills}>
        <Pill
          icon="layers"
          label={`${deck.card_count} ${deck.card_count === 1 ? "tarjeta" : "tarjetas"}`}
        />
        {(deck.tags || []).map((t) => (
          <Pill key={t.id} label={t.name} />
        ))}
        {deck.priority < 100 ? (
          <Pill
            color={colors.accentText}
            label={deck.priority === 0 ? "Pausado" : `${deck.priority}%`}
          />
        ) : null}
      </View>
      {progress && progress.pct > 0 ? (
        <ProgressBar pct={progress.pct} gradient={gradients.bar} style={{ marginTop: spacing.sm }} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: "center",
    justifyContent: "center",
  },
  name: {
    ...type.body,
    fontWeight: "600",
    flex: 1,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
});
