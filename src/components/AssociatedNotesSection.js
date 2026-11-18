import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, spacing } from "../theme";

export default function AssociatedNotesSection({
  notes = [],
  title = "Notas",
  onOpenNote,
  onCreateNote,
}) {
  const [expanded, setExpanded] = useState(true);

  if (!notes.length) {
    if (!onCreateNote) return null;
    return (
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nueva nota asociada"
          onPress={onCreateNote}
          style={({ pressed, hovered }) => [
            styles.ghostCreateRow,
            hovered && styles.rowHover,
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="plus" size={16} color={colors.textMuted} />
          <Text style={styles.ghostCreateText}>Nueva nota</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Plegar" : "Desplegar"} ${title}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={styles.headerToggle}
        >
          <Text style={styles.headerLabel}>
            {title.toUpperCase()} · {notes.length}
          </Text>
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.textMuted} />
        </Pressable>
        {onCreateNote ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nueva nota asociada"
            onPress={onCreateNote}
            hitSlop={6}
            style={({ pressed, hovered }) => [
              styles.addGhost,
              hovered && styles.rowHover,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name="plus" size={14} color={colors.textMuted} />
            <Text style={styles.addGhostText}>Nueva</Text>
          </Pressable>
        ) : null}
      </View>

      {expanded ? (
        <View style={styles.list}>
          {notes.map((note) => {
            const originText =
              note.origin?.kind && note.origin.kind !== "direct" && note.origin.label
                ? note.origin.label
                : "";
            return (
              <Pressable
                key={note.id}
                accessibilityRole="button"
                accessibilityLabel={`Abrir nota ${note.title || "sin título"}`}
                onPress={() => onOpenNote?.(note.id)}
                style={({ pressed, hovered }) => [
                  styles.itemRow,
                  hovered && styles.rowHover,
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Feather
                  name={note.pinned ? "bookmark" : "file-text"}
                  size={16}
                  color={note.pinned ? colors.accentText : colors.textMuted}
                />
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {note.title?.trim() || "Sin título"}
                </Text>
                {originText ? (
                  <Text style={styles.originTag} numberOfLines={1}>
                    {originText}
                  </Text>
                ) : null}
                <Feather name="chevron-right" size={15} color={colors.textMuted} style={{ opacity: 0.55 }} />
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 6,
  },
  ghostCreateRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  ghostCreateText: {
    ...font(500),
    fontSize: 13,
    color: colors.textMuted,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerToggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  headerLabel: {
    ...font(600),
    fontSize: 11,
    letterSpacing: 0.7,
    color: colors.textMuted,
  },
  addGhost: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  addGhostText: {
    ...font(500),
    fontSize: 12.5,
    color: colors.textMuted,
  },
  list: {
    gap: 4,
  },
  itemRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  rowHover: {
    backgroundColor: colors.surfaceHigh,
  },
  itemTitle: {
    ...font(500),
    color: colors.text,
    fontSize: 13.5,
    flex: 1,
  },
  originTag: {
    fontSize: 11.5,
    color: colors.textMuted,
    maxWidth: 120,
  },
});
