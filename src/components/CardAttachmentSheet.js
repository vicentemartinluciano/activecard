import Feather from "@expo/vector-icons/Feather";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { listAllCardsForSearch } from "../db/cards";
import { listDecks } from "../db/decks";
import { listFolders } from "../db/folders";
import { filterDeckCards } from "../lib/search";
import { toPlainText } from "../lib/richtext";
import { colors, font, radius, spacing, type } from "../theme";
import ActionSheet from "./ActionSheet";
import { Button, Chip, Field } from "./ui";

export default function CardAttachmentSheet({ visible, onClose, selected = [], onConfirm }) {
  const [cards, setCards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [deckNames, setDeckNames] = useState({});
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState([]);
  const [folderFilter, setFolderFilter] = useState("all");
  const [deckFilter, setDeckFilter] = useState(null);
  const [tagFilters, setTagFilters] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setDraftIds(selected.map((card) => card.id));
    setFolderFilter("all");
    setDeckFilter(null);
    setTagFilters([]);
    setLoading(true);
    Promise.all([listAllCardsForSearch(), listDecks(), listFolders()])
      .then(([allCards, allDecks, allFolders]) => {
        if (!alive) return;
        setCards(allCards);
        setDecks(allDecks);
        setFolders(allFolders);
        setDeckNames(Object.fromEntries(allDecks.map((deck) => [deck.id, deck.name])));
      })
      .catch(() => {
        if (alive) setCards([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected, visible]);

  const visibleDecks = useMemo(() => decks.filter((deck) => {
    if (folderFilter === "loose" && deck.folder_id) return false;
    if (folderFilter !== "all" && folderFilter !== "loose" && Number(deck.folder_id) !== Number(folderFilter)) return false;
    return true;
  }), [decks, folderFilter]);
  const visibleTags = useMemo(() => {
    const byId = new Map();
    for (const deck of visibleDecks) {
      for (const tag of deck.tags || []) byId.set(tag.id, tag);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [visibleDecks]);
  const visibleCards = useMemo(() => filterDeckCards(cards, query).filter((card) => {
    const deck = decks.find((item) => item.id === card.deck_id);
    if (!deck) return false;
    if (folderFilter === "loose" && deck.folder_id) return false;
    if (folderFilter !== "all" && folderFilter !== "loose" && Number(deck.folder_id) !== Number(folderFilter)) return false;
    if (deckFilter && deck.id !== deckFilter) return false;
    if (tagFilters.length && !(deck.tags || []).some((tag) => tagFilters.includes(tag.id))) return false;
    return true;
  }), [cards, deckFilter, decks, folderFilter, query, tagFilters]);
  const selectFolder = (value) => {
    setFolderFilter(value);
    setDeckFilter(null);
    setTagFilters([]);
  };
  const toggleTag = (id) => {
    setTagFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const toggle = (id) => {
    setDraftIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const confirm = () => {
    const byId = new Map([...selected, ...cards].map((card) => [card.id, card]));
    onConfirm(draftIds.map((id) => {
      const card = byId.get(id);
      return card ? { ...card, deckName: deckNames[card.deck_id] || card.deckName || "Mazo" } : null;
    }).filter(Boolean));
    setQuery("");
    onClose();
  };

  return (
    <ActionSheet visible={visible} onClose={onClose} title="Adjuntar tarjetas">
      <View style={styles.search}>
        <Feather name="search" size={17} color={colors.textMuted} />
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar tarjetas…"
          style={styles.searchField}
        />
      </View>
      <Text style={styles.filterLabel}>Carpeta</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <Chip label="Todas" active={folderFilter === "all"} onPress={() => selectFolder("all")} />
        <Chip label="Sin carpeta" active={folderFilter === "loose"} onPress={() => selectFolder("loose")} />
        {folders.map((folder) => (
          <Chip key={folder.id} label={folder.name} active={Number(folderFilter) === folder.id} onPress={() => selectFolder(folder.id)} />
        ))}
      </ScrollView>
      {visibleDecks.length ? (
        <>
          <Text style={styles.filterLabel}>Mazo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <Chip label="Todos" active={!deckFilter} onPress={() => setDeckFilter(null)} />
            {visibleDecks.map((deck) => (
              <Chip key={deck.id} label={deck.name} active={deckFilter === deck.id} onPress={() => setDeckFilter(deck.id)} />
            ))}
          </ScrollView>
        </>
      ) : null}
      {visibleTags.length ? (
        <>
          <Text style={styles.filterLabel}>Etiquetas</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {visibleTags.map((tag) => (
              <Chip key={tag.id} label={tag.name} active={tagFilters.includes(tag.id)} onPress={() => toggleTag(tag.id)} />
            ))}
          </ScrollView>
        </>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loading} />
      ) : (
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {visibleCards.map((card) => {
            const active = draftIds.includes(card.id);
            return (
              <Pressable key={card.id} onPress={() => toggle(card.id)} style={styles.row}>
                <View style={[styles.check, active && styles.checkActive]}>
                  {active ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                </View>
                <View style={styles.copy}>
                  <Text style={styles.front} numberOfLines={2}>{toPlainText(card.front)}</Text>
                  <Text style={styles.deck} numberOfLines={1}>{deckNames[card.deck_id] || "Mazo"}</Text>
                </View>
              </Pressable>
            );
          })}
          {visibleCards.length === 0 ? <Text style={styles.empty}>No encontré tarjetas.</Text> : null}
        </ScrollView>
      )}
      <Button
        label={draftIds.length ? `Adjuntar ${draftIds.length}` : "Elegí al menos una"}
        onPress={confirm}
        disabled={draftIds.length === 0}
      />
    </ActionSheet>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.pillBg,
  },
  searchField: { flex: 1, borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0 },
  filterLabel: { ...type.label, fontSize: 10, marginTop: 2 },
  filterRow: { gap: spacing.xs, paddingRight: spacing.md },
  loading: { paddingVertical: spacing.xl },
  list: { maxHeight: 330 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  checkActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  copy: { flex: 1, gap: 2 },
  front: { ...type.body, ...font(600), fontSize: 14 },
  deck: { ...type.small, fontSize: 11 },
  empty: { ...type.small, textAlign: "center", paddingVertical: spacing.xl },
});
