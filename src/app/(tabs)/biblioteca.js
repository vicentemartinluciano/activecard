import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import DeckListItem from "../../components/DeckListItem";
import Skeleton from "../../components/Skeleton";
import { Card, Chip, EmptyState, Field, Pill, Screen } from "../../components/ui";
import { listAllCards } from "../../db/cards";
import { listDecksWithConnections } from "../../db/connections";
import { listDecks, listTags } from "../../db/decks";
import { listFolders } from "../../db/folders";
import { getDecksDailyProgress } from "../../db/progress";
import { searchLibrary } from "../../lib/search";
import { toPlainText } from "../../lib/richtext";
import { colors, glow, radius, spacing, type } from "../../theme";

export default function Biblioteca() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [tags, setTags] = useState([]);
  const [allCards, setAllCards] = useState([]);
  const [activeTagIds, setActiveTagIds] = useState([]);
  const [progressByDeck, setProgressByDeck] = useState({});
  const [gymDecks, setGymDecks] = useState([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false); // false solo hasta el primer fetch exitoso

  const refresh = useCallback(() => {
    let alive = true;
    Promise.all([
      listDecks(),
      listFolders(),
      listTags(),
      listAllCards(),
      getDecksDailyProgress(),
      listDecksWithConnections(),
    ]).then(([d, f, t, c, p, g]) => {
      if (!alive) return;
      setDecks(d);
      setFolders(f);
      setTags(t);
      setAllCards(c);
      setProgressByDeck(p);
      setGymDecks(g);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(refresh);

  const toggleTag = (tagId) => {
    setActiveTagIds((ids) =>
      ids.includes(tagId) ? ids.filter((t) => t !== tagId) : [...ids, tagId]
    );
  };

  // La lista principal muestra solo los mazos sueltos; los que tienen carpeta
  // viven dentro de su carpeta (grilla de arriba). Filtrar por etiqueta pasa a
  // ser global: busca sobre TODOS los mazos, no solo los sueltos.
  const looseDecks = decks.filter((d) => !d.folder_id);
  const tagFiltering = activeTagIds.length > 0;
  const visibleDecks = tagFiltering
    ? decks.filter((d) => d.tags.some((t) => activeTagIds.includes(t.id)))
    : looseDecks;
  const folderNameById = Object.fromEntries(folders.map((f) => [f.id, f.name]));

  const searching = query.trim().length > 0;
  const results = searching
    ? searchLibrary(query, { folders, decks, cards: allCards })
    : null;
  const deckNameById = {};
  for (const d of decks) deckNameById[d.id] = d.name;

  if (!loaded) {
    return (
      <Screen safeTop>
        <View style={styles.folderGrid}>
          <Skeleton height={110} style={{ flexGrow: 1, flexBasis: "45%" }} />
          <Skeleton height={110} style={{ flexGrow: 1, flexBasis: "45%" }} />
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Skeleton height={96} />
          <Skeleton height={96} />
          <Skeleton height={96} />
        </View>
      </Screen>
    );
  }

  if (searching) {
    const empty =
      results.folders.length === 0 && results.decks.length === 0 && results.cards.length === 0;
    return (
      <Screen safeTop>
        <View style={styles.searchRow}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar carpetas, mazos o tarjetas…"
            style={styles.searchField}
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
              {empty ? <EmptyState text="Sin resultados." icon="search" /> : null}
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
    <Screen safeTop>
      <View style={styles.searchRow}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar carpetas, mazos o tarjetas…"
          style={styles.searchField}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

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
          !tagFiltering ? (
            <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
              {folders.length > 0 || gymDecks.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={type.label}>Carpetas</Text>
                  <View style={styles.folderGrid}>
                    {gymDecks.length > 0 ? (
                      <Card
                        onPress={() => router.push("/carpetas/gimnasio")}
                        style={[styles.folderTile, styles.gymTile]}
                      >
                        <Feather name="zap" size={22} color={colors.streak} />
                        <Text style={styles.folderName} numberOfLines={1}>
                          Gimnasio Mental
                        </Text>
                        <Pill
                          color={colors.accentText}
                          label={`${gymDecks.length} ${gymDecks.length === 1 ? "mazo" : "mazos"}`}
                        />
                      </Card>
                    ) : null}
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
                </View>
              ) : null}
              <Text style={[type.label, { marginTop: spacing.sm }]}>Mazos</Text>
            </View>
          ) : (
            <Text style={[type.label, { marginBottom: spacing.sm }]}>Resultados</Text>
          )
        }
        ListEmptyComponent={
          <EmptyState
            text={
              tagFiltering
                ? "Ningún mazo tiene esas etiquetas."
                : decks.length === 0
                  ? "Todavía no hay mazos. Creá el primero en la pestaña Crear."
                  : looseDecks.length === 0
                    ? "Todos los mazos están dentro de carpetas."
                    : "Ningún mazo suelto tiene esas etiquetas."
            }
            icon="search"
          />
        }
        renderItem={({ item }) => (
          <DeckListItem
            deck={item}
            progress={progressByDeck[item.id]}
            folderName={tagFiltering ? folderNameById[item.folder_id] : undefined}
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
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  searchField: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
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
  folderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  folderTile: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: spacing.sm,
  },
  gymTile: {
    borderColor: "rgba(158,110,222,0.25)",
    ...glow.violet,
  },
  folderName: {
    ...type.body,
    fontWeight: "600",
  },
});
