// Fila de mazo minimalista: ícono, nombre y dos píldoras arriba a la derecha
// (N° de tarjetas + prioridad %, mismo color neutro), más la barra de progreso
// diario. Compartida entre la Biblioteca y la pantalla de carpeta.

import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";

import ProgressBar from "./ProgressBar";
import { Card, Pill } from "./ui";
import { colors, glow, gradients, radius, spacing, type } from "../theme";

export default function DeckListItem({ deck, progress, onPress }) {
  return (
    <Card onPress={onPress} style={styles.cardOuter}>
      <LinearGradient
        colors={gradients.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardInner}
      >
        <View style={styles.row}>
          <View style={styles.icon}>
            <Feather name={deck.icon || "book"} size={20} color={colors.accentText} />
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {deck.name}
          </Text>
          <View style={styles.metaPills}>
            <Pill icon="layers" label={`${deck.card_count}`} />
            {deck.priority < 100 ? (
              <Pill label={deck.priority === 0 ? "Pausado" : `${deck.priority}%`} />
            ) : null}
          </View>
        </View>
        {progress && progress.pct > 0 ? (
          <ProgressBar
            pct={progress.pct}
            gradient={gradients.progress}
            glowStyle={glow.green}
            style={{ marginTop: spacing.sm }}
          />
        ) : null}
      </LinearGradient>
    </Card>
  );
}

const styles = StyleSheet.create({
  // El degradé va adentro del Card: el Card queda sin padding y el gradiente
  // lo repone, respetando el radio del contenedor.
  cardOuter: {
    padding: 0,
    overflow: "hidden",
  },
  cardInner: {
    padding: spacing.md,
    borderRadius: radius.lg,
    minHeight: 76,
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  metaPills: {
    flexDirection: "row",
    gap: spacing.xs,
    alignItems: "center",
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
});
