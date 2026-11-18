import Feather from "@expo/vector-icons/Feather";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, font, radius, spacing, type } from "../theme";
import { Card, Pill } from "./ui";

export default function AssociatedNotesSection({
  notes = [],
  title = "Notas asociadas",
  emptyText = "Todavía no hay notas asociadas.",
  onOpenNote,
  onCreateNote,
}) {
  const [expanded, setExpanded] = useState(true);

  if (!notes.length) {
    return (
      <View style={styles.emptyBar}>
        <View style={styles.emptyLeft}>
          <Feather name="file-text" size={16} color={colors.textMuted} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={type.label}>{title}</Text>
            <Text style={type.small} numberOfLines={2}>{emptyText}</Text>
          </View>
        </View>
        {onCreateNote ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nueva nota asociada"
            onPress={onCreateNote}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="plus" size={15} color={colors.accentText} />
            <Text style={styles.addBtnText}>Nueva nota</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Card style={styles.panel}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Plegar" : "Desplegar"} ${title}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={styles.headerToggle}
        >
          <Feather name="file-text" size={17} color={colors.accentText} />
          <Text style={styles.headerTitle}>{title}</Text>
          <Pill label={String(notes.length)} color={colors.accentText} />
          <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textMuted} />
        </Pressable>
        {onCreateNote ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nueva nota asociada"
            onPress={onCreateNote}
            hitSlop={6}
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <Feather name="plus" size={15} color={colors.accentText} />
            <Text style={styles.addBtnText}>Nueva nota</Text>
          </Pressable>
        ) : null}
      </View>

      {expanded ? (
        <View style={styles.list}>
          {notes.map((note) => (
            <Card
              key={note.id}
              level="high"
              accessibilityLabel={`Abrir nota ${note.title || "sin título"}`}
              onPress={() => onOpenNote?.(note.id)}
              style={styles.itemCard}
            >
              <View style={styles.itemRow}>
                <Feather
                  name={note.pinned ? "bookmark" : "file-text"}
                  size={16}
                  color={note.pinned ? colors.accentText : colors.textMuted}
                />
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {note.title?.trim() || "Nota sin título"}
                    </Text>
                    {note.origin?.label ? (
                      <Pill
                        label={note.origin.label}
                        color={note.origin.kind === "direct" ? colors.accentText : colors.textMuted}
                      />
                    ) : null}
                  </View>
                  {note.excerpt ? (
                    <Text style={type.small} numberOfLines={2}>
                      {note.excerpt}
                    </Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={16} color={colors.textMuted} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  emptyLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  panel: {
    gap: spacing.sm,
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
    gap: spacing.xs + 2,
    paddingVertical: 4,
  },
  headerTitle: {
    ...font(600),
    color: colors.text,
    fontSize: 15,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentBg,
    borderWidth: 1,
    borderColor: colors.accentMuted,
  },
  addBtnText: {
    ...font(600),
    fontSize: 12,
    color: colors.accentText,
  },
  list: {
    gap: spacing.xs + 2,
  },
  itemCard: {
    padding: spacing.sm + 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  itemTitle: {
    ...font(600),
    color: colors.text,
    fontSize: 14,
    flexShrink: 1,
  },
});
