import Feather from "@expo/vector-icons/Feather";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { listAllCardsForSearch } from "../db/cards";
import { listDecks } from "../db/decks";
import { filterDeckCards } from "../lib/search";
import { toPlainText } from "../lib/richtext";
import { colors, font, radius, spacing, type } from "../theme";
import ActionSheet from "./ActionSheet";
import { Button, Field } from "./ui";

export default function CardAttachmentSheet({ visible, onClose, selected = [], onConfirm }) {
  const [cards, setCards] = useState([]);
  const [deckNames, setDeckNames] = useState({});
  const [query, setQuery] = useState("");
  const [draftIds, setDraftIds] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setDraftIds(selected.map((card) => card.id));
    setLoading(true);
    Promise.all([listAllCardsForSearch(), listDecks()])
      .then(([allCards, decks]) => {
        if (!alive) return;
        setCards(allCards);
        setDeckNames(Object.fromEntries(decks.map((deck) => [deck.id, deck.name])));
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

  const visibleCards = useMemo(() => filterDeckCards(cards, query), [cards, query]);
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
