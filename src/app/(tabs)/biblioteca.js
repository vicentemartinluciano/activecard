import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import DeckListItem from "../../components/DeckListItem";
import { Card, Chip, EmptyState, Field, InlineAdd, Pill, Screen } from "../../components/ui";
import { listAllCards } from "../../db/cards";
import { createDeck, listDecks, listTags } from "../../db/decks";
import { createFolder, listFolders } from "../../db/folders";
import { getDecksDailyProgress } from "../../db/progress";
import { searchLibrary } from "../../lib/search";
import { toPlainText } from "../../lib/richtext";
import { colors, spacing, type } from "../../theme";

export default function Biblioteca() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [progressByDeck, setProgressByDeck] = useState({});
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = useCallback(() => {
    let alive = true;
    Promise.all([
      listDecks(),
      listFolders(),
      listTags(),
      listAllCards(),
      getDecksDailyProgress(),
    ]).then(([d, f, t, c, p]) => {
      if (!alive) return;
      setDecks(d);
      setFolders(f);
      setTags(t);
      setAllCards(c);
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

  const searching = query.trim().length > 0;
  const results = searching
    ? searchLibrary(query, { folders, decks, cards: allCards })
    : null;
  const deckNameById = {};
  for (const d of decks) deckNameById[d.id] = d.name;

  if (searching) {
    const empty =
      results.folders.length === 0 && results.decks.length === 0 && results.cards.length === 0;
    return (
      <Screen>
        <View style={styles.searchRow}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar carpetas, mazos o tarjetas…"
            style={{ flex: 1 }}
          />
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={{ paddingVertical: spacing.md }}
          ListHeaderComponent={
            <View style={{ gap: spacing.md }}>
              {empty ? <EmptyState text="Sin resultados." /> : null}
              {results.folders.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={type.label}>Carpetas</Text>
                  {results.folders.map((f) => (
                    <Card
                      key={f.id}
                      onPress={() => router.push(`/carpetas/${f.id}`)}
                      style={styles.searchFolderRow}
                    >
                      <Feather name="folder" size={20} color={colors.accentText} />
                      <Text style={[styles.folderName, { flex: 1 }]} numberOfLines={1}>
                        {f.name}
                      </Text>
                      <Pill label={`${f.deck_count} ${f.deck_count === 1 ? "mazo" : "mazos"}`} />
                    </Card>
                  ))}
                </View>
              ) : null}
              {results.decks.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={type.label}>Mazos</Text>
                  {results.decks.map((d) => (
                    <DeckListItem
                      key={d.id}
                      deck={d}
                      progress={progressByDeck[d.id]}
                      onPress={() => router.push(`/mazos/${d.id}`)}
                    />
                  ))}
                </View>
              ) : null}
              {results.cards.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={type.label}>Tarjetas</Text>
                  {results.cards.map((c) => (
                    <Card
                      key={c.id}
                      level="high"
                      onPress={() => router.push(`/mazos/${c.deck_id}/tarjeta?cardId=${c.id}`)}
                      style={{ gap: spacing.xs }}
                    >
                      <Text style={type.body} numberOfLines={1}>
                        {toPlainText(c.front)}
                      </Text>
                      <Text style={type.small} numberOfLines={1}>
                        {toPlainText(c.back)}
                      </Text>
                      {deckNameById[c.deck_id] ? (
                        <Pill label={deckNameById[c.deck_id]} />
                      ) : null}
                    </Card>
                  ))}
                </View>
              ) : null}
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.searchRow}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar carpetas, mazos o tarjetas…"
          style={{ flex: 1 }}
        />
      </View>

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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchFolderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
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
