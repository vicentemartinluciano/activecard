import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import ChatAuditor from "../../components/ChatAuditor";
import Toast from "../../components/Toast";
import { Card, EmptyState, Field, Screen } from "../../components/ui";
import { getCard, listAllCardsForSearch } from "../../db/cards";
import { listDecks } from "../../db/decks";
import { filterDeckCards } from "../../lib/search";
import { toPlainText } from "../../lib/richtext";
import { colors, font, radius, spacing, type } from "../../theme";

export default function NuevaCharla() {
  const { cardId, deckId } = useLocalSearchParams();
  const router = useRouter();
  const requestedCardId = cardId ? Number(cardId) : null;
  const requestedDeckId = deckId ? Number(deckId) : null;

  const [card, setCard] = useState(null);
  const [options, setOptions] = useState([]);
  const [deckNames, setDeckNames] = useState({});
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    const load = requestedCardId
      ? getCard(requestedCardId).then((selected) => {
          if (!selected) throw new Error("Tarjeta inexistente");
          if (alive) setCard(selected);
        })
      : Promise.all([listAllCardsForSearch(), listDecks()]).then(([cards, decks]) => {
          if (!alive) return;
          setOptions(
            requestedDeckId == null
              ? cards
              : cards.filter((candidate) => candidate.deck_id === requestedDeckId)
          );
          setDeckNames(Object.fromEntries(decks.map((deck) => [deck.id, deck.name])));
        });

    load
      .catch(() => {
        if (alive) setError("No pudimos cargar las tarjetas para el Gimnasio.");
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [requestedCardId, requestedDeckId]);

  const chooseCard = async (id) => {
    try {
      const selected = await getCard(id);
      if (!selected) throw new Error("Tarjeta inexistente");
      setCard(selected);
      setError("");
    } catch {
      setError("No pudimos abrir esa tarjeta.");
    }
  };

  const finish = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/gimnasio");
  };

  if (!loaded) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Nueva conexión" }} />
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  if (card) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Pensar con el socio" }} />
        <Card level="high" style={styles.contextCard}>
          <Text style={styles.contextLabel}>Idea de partida</Text>
          <Text style={styles.contextText} numberOfLines={3}>
            {toPlainText(card.front)}
          </Text>
        </Card>
        <View style={{ flex: 1, marginTop: spacing.md }}>
          <ChatAuditor card={card} onDone={finish} />
        </View>
        <Toast message={error} onDismiss={() => setError("")} />
      </Screen>
    );
  }

  const visibleOptions = filterDeckCards(options, query);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Elegí una tarjeta" }} />
      <View style={styles.search}>
        <Feather name="search" size={17} color={colors.textMuted} />
        <Field
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar una idea para conectar…"
          style={styles.searchField}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Feather name="x" size={17} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <FlatList
        data={visibleOptions}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
        ListEmptyComponent={
          <EmptyState
            icon="search"
            text={
              query
                ? "No hay tarjetas que coincidan."
                : "Necesitás al menos una tarjeta para iniciar una conexión."
            }
          />
        }
        renderItem={({ item }) => (
          <Card level="high" onPress={() => chooseCard(item.id)} style={styles.option}>
            <Text style={styles.optionFront} numberOfLines={2}>
              {toPlainText(item.front)}
            </Text>
            {deckNames[item.deck_id] ? (
              <Text style={type.small}>{deckNames[item.deck_id]}</Text>
            ) : null}
          </Card>
        )}
      />
      <Toast message={error} onDismiss={() => setError("")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  contextCard: {
    gap: spacing.xs,
  },
  contextLabel: {
    ...type.small,
    ...font(700),
    color: colors.accentText,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  contextText: {
    ...type.body,
    ...font(600),
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  searchField: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  option: {
    gap: spacing.xs,
  },
  optionFront: {
    ...type.body,
    ...font(600),
  },
});
