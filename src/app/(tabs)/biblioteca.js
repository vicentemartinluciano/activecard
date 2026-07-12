import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";

import DeckListItem from "../../components/DeckListItem";
import { Chip, EmptyState, InlineAdd, Screen } from "../../components/ui";
import { createDeck, listDecks, listTags } from "../../db/decks";
import { getDecksDailyProgress } from "../../db/progress";
import { spacing } from "../../theme";

export default function Biblioteca() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [progressByDeck, setProgressByDeck] = useState({});

  const refresh = useCallback(() => {
    let alive = true;
    Promise.all([listDecks(), listTags(), getDecksDailyProgress()]).then(([d, t, p]) => {
      if (!alive) return;
      setDecks(d);
      setTags(t);
      setProgressByDeck(p);
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
          <DeckListItem
            deck={item}
            progress={progressByDeck[item.id]}
            onPress={() => router.push(`/mazos/${item.id}`)}
          />
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
});
