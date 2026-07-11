// Grilla de íconos de línea (Feather) para elegir el ícono de un mazo.

import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";

import { colors, radius, spacing } from "../theme";

export const DECK_ICONS = [
  "book",
  "book-open",
  "briefcase",
  "globe",
  "heart",
  "star",
  "zap",
  "coffee",
  "music",
  "film",
  "cpu",
  "code",
  "dollar-sign",
  "trending-up",
  "users",
  "mic",
  "feather",
  "layers",
  "target",
  "compass",
  "anchor",
  "sun",
  "moon",
  "aperture",
];

export default function IconPicker({ value, onChange }) {
  return (
    <View style={styles.grid}>
      {DECK_ICONS.map((name) => {
        const active = value === name;
        return (
          <Pressable
            key={name}
            onPress={() => onChange(name)}
            style={({ pressed }) => [
              styles.cell,
              active && styles.cellActive,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Feather name={name} size={20} color={active ? colors.accentText : colors.textMuted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  cell: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cellActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
});
