// Fila de mazo minimalista: ícono, nombre y dos píldoras arriba a la derecha
// (N° de tarjetas + prioridad %, mismo color neutro), más la barra de progreso
// diario. Compartida entre la Biblioteca y la pantalla de carpeta.

import Feather from "@expo/vector-icons/Feather";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import ProgressBar from "./ProgressBar";
import { Card, Pill } from "./ui";
import { colors, font, glow, gradients, radius, spacing, type } from "../theme";

export default function DeckListItem({ deck, progress, onPress, onOptions }) {
  const rowContent = (
    <>
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
    </>
  );

  return (
    <Card onPress={onOptions ? undefined : onPress} style={styles.cardOuter}>
      <LinearGradient
        colors={gradients.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardInner}
      >
        <View style={styles.row}>
          {onOptions ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={deck.name}
              onPress={onPress}
              style={({ pressed }) => [styles.mainPress, pressed && { opacity: 0.75 }]}
            >
              {rowContent}
            </Pressable>
          ) : (
            rowContent
          )}
          {onOptions ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Opciones del mazo ${deck.name}`}
              hitSlop={8}
              onPress={() => onOptions(deck)}
              style={({ pressed }) => [styles.optionsBtn, pressed && { opacity: 0.7 }]}
            >
              <Feather name="more-horizontal" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
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
    gap: spacing.sm,
  },
  mainPress: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  optionsBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -4,
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
    ...font(600),
    flex: 1,
  },
});
