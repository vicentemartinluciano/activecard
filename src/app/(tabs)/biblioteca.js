import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import DeckListItem from "../../components/DeckListItem";
import { Card, Chip, EmptyState, InlineAdd, Pill, Screen } from "../../components/ui";
import { createDeck, listDecks, listTags } from "../../db/decks";
import { createFolder, listFolders } from "../../db/folders";
import { getDecksDailyProgress } from "../../db/progress";
import { colors, spacing, type } from "../../theme";

export default function Biblioteca() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [progressByDeck, setProgressByDeck] = useState({});
  const [showNewFolder, setShowNewFolder] = useState(false);

  const refresh = useCallback(() => {
    let alive = true;
    Promise.all([listDecks(), listFolders(), listTags(), getDecksDailyProgress()]).then(
      ([d, f, t, p]) => {
        if (!alive) return;
        setDecks(d);
        setFolders(f);
        setTags(t);
        setProgressByDeck(p);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(refresh);

  const onCreate = async (name) => {
    const id = await createDeck(name);
    router.push(`/mazos/${id}`);
  };

  const onCreateFolder = async (name) => {
    await createFolder(name);
    setShowNewFolder(false);
    refresh();
  };

  const toggleTag = (tagId) => {
    setActiveTagIds((ids) =>
      ids.includes(tagId) ? ids.filter((t) => t !== tagId) : [...ids, tagId]
    );
  };

  // La lista principal muestra solo los mazos sueltos; los que tienen carpeta
  // viven dentro de su carpeta (grilla de arriba).
  const looseDecks = decks.filter((d) => !d.folder_id);
  const visibleDecks =
    activeTagIds.length === 0
      ? looseDecks
      : looseDecks.filter((d) => d.tags.some((t) => activeTagIds.includes(t.id)));

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
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={styles.folderHeader}>
              <Text style={type.label}>Carpetas</Text>
              <Pill
                label="+ Nueva carpeta"
                color={colors.accentText}
                onPress={() => setShowNewFolder((s) => !s)}
              />
            </View>
            {showNewFolder ? (
              <InlineAdd placeholder="Nombre de la carpeta…" onSubmit={onCreateFolder} />
            ) : null}
            {folders.length > 0 ? (
              <View style={styles.folderGrid}>
                {folders.map((f) => (
                  <Card
                    key={f.id}
                    onPress={() => router.push(`/carpetas/${f.id}`)}
                    style={styles.folderTile}
                  >
                    <Feather name="folder" size={22} color={colors.accentText} />
                    <Text style={styles.folderName} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Pill label={`${f.deck_count} ${f.deck_count === 1 ? "mazo" : "mazos"}`} />
                  </Card>
                ))}
              </View>
            ) : null}
            <Text style={[type.label, { marginTop: spacing.sm }]}>Mazos</Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            text={
              decks.length === 0
                ? "Todavía no hay mazos. Creá el primero arriba."
                : looseDecks.length === 0
                  ? "Todos los mazos están dentro de carpetas."
                  : "Ningún mazo suelto tiene esas etiquetas."
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
  folderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  folderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  folderTile: {
    width: "48%",
    gap: spacing.sm,
  },
  folderName: {
    ...type.body,
    fontWeight: "600",
  },
});
