import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { colors, font, spacing, type } from "../theme";
import ActionSheet from "./ActionSheet";
import RichText from "./RichText";
import { Button, Chip, Pill } from "./ui";

export default function ReferenceNotesSheet({
  visible,
  notes = [],
  deckName = "",
  onClose,
  onEditNote,
}) {
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!visible) return;
    if (!notes.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((prev) => (notes.some((n) => n.id === prev) ? prev : notes[0].id));
  }, [visible, notes]);

  const active = notes.find((n) => n.id === selectedId) || notes[0] || null;

  return (
    <ActionSheet
      visible={visible && !!active}
      title={deckName ? `Notas · ${deckName}` : "Nota de referencia"}
      onClose={onClose}
    >
      {active ? (
        <View style={{ gap: spacing.sm }}>
          {notes.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
              {notes.map((note) => (
                <Chip
                  key={note.id}
                  label={note.title?.trim() || "Nota sin título"}
                  active={note.id === active.id}
                  onPress={() => setSelectedId(note.id)}
                />
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.meta}>
            <Text style={styles.noteTitle}>{active.title?.trim() || "Sin título"}</Text>
            {active.origin?.label ? <Pill label={active.origin.label} color={colors.accentText} /> : null}
            {(active.tags || []).map((tag) => (
              <Pill key={tag.id} label={`#${tag.name}`} />
            ))}
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.bodyScroll} contentContainerStyle={{ paddingBottom: spacing.md }}>
            {active.body?.trim() ? (
              <RichText text={active.body} style={[type.body, { lineHeight: 24 }]} />
            ) : (
              <Text style={type.small}>Nota sin contenido todavía.</Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Button label="Cerrar" onPress={onClose} style={{ flex: 1 }} />
            {onEditNote ? (
              <Button
                label="Editar nota"
                kind="primary"
                onPress={() => onEditNote(active.id)}
                style={{ flex: 1 }}
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  noteTitle: {
    ...font(700),
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
    marginRight: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  bodyScroll: {
    maxHeight: 400,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
});
