import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Chip, EmptyState, InlineAdd, Screen } from "../../components/ui";
import { createDeck, listDecks, listTags } from "../../db/decks";
import { colors, radius, spacing, type } from "../../theme";

export default function Biblioteca() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTagIds, setActiveTagIds] = useState([]);

  const refresh = useCallback(() => {
    let alive = true;
    Promise.all([listDecks(), listTags()]).then(([d, t]) => {
      if (!alive) return;
      setDecks(d);
      setTags(t);
    });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(refresh);

  const onCreate = async (name) => {
    const id = await createDeck(name);
    router.push(`/mazos/${id}`);
  };

  const toggleTag = (tagId) => {
    setActiveTagIds((ids) =>
      ids.includes(tagId) ? ids.filter((t) => t !== tagId) : [...ids, tagId]
    );
  };

  const visibleDecks =
    activeTagIds.length === 0
      ? decks
      : decks.filter((d) => d.tags.some((t) => activeTagIds.includes(t.id)));

  return (
    <Screen>
      <InlineAdd placeholder="Nombre del mazo nuevo…" buttonLabel="Crear" onSubmit={onCreate} />

      {tags.length > 0 ? (
        <View style={styles.tagRow}>
          {tags.map((t) => (
            <Chip
              key={t.id}
              label={t.name}
              active={activeTagIds.includes(t.id)}
              onPress={() => toggleTag(t.id)}
            />
          ))}
        </View>
      ) : null}

      <FlatList
        data={visibleDecks}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}
        ListEmptyComponent={
          <EmptyState
            text={
              decks.length === 0
                ? "Todavía no hay mazos. Creá el primero arriba."
                : "Ningún mazo tiene esas etiquetas."
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/mazos/${item.id}`)}
            style={({ pressed }) => [styles.deck, pressed && { opacity: 0.7 }]}
          >
            <View style={styles.deckIcon}>
              <Feather name={item.icon || "book"} size={20} color={colors.accentText} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deckName}>{item.name}</Text>
              <Text style={type.small}>
                {item.card_count} {item.card_count === 1 ? "tarjeta" : "tarjetas"}
                {item.tags.length > 0 ? ` · ${item.tags.map((t) => t.name).join(", ")}` : ""}
              </Text>
            </View>
            {item.priority < 100 ? (
              <Text style={styles.priorityBadge}>
                {item.priority === 0 ? "Pausado" : `${item.priority}%`}
              </Text>
            ) : null}
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  deck: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  deckIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  deckName: {
    ...type.body,
    fontWeight: "600",
    marginBottom: 2,
  },
  priorityBadge: {
    ...type.small,
    color: colors.accentText,
    fontWeight: "700",
  },
});
