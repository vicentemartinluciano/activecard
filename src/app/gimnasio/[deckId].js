// Ideas de un mazo (Gimnasio Mental): filas de las tarjetas-idea reales.
// Tocar una abre el editor de la tarjeta — editar acá edita la tarjeta del
// mazo (es LA misma card). El useFocusEffect refresca al volver del editor.

import { Feather } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text } from "react-native";

import Toast from "../../components/Toast";
import { Card, EmptyState, Screen } from "../../components/ui";
import { listIdeaCards } from "../../db/cards";
import { getDeck } from "../../db/decks";
import { toPlainText } from "../../lib/richtext";
import { colors, font, radius, spacing, type } from "../../theme";

export default function IdeasDelMazo() {
  const { deckId } = useLocalSearchParams();
  const id = Number(deckId);
  const router = useRouter();
  const [deck, setDeck] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [loadError, setLoadError] = useState("");

  const refresh = useCallback(() => {
    let alive = true;
    Promise.all([getDeck(id), listIdeaCards(id)])
      .then(([d, i]) => {
        if (!alive) return;
        setDeck(d);
        setIdeas(i);
        setLoadError("");
      })
      .catch(() => {
        if (!alive) return;
        setLoadError("No pudimos cargar las ideas de este mazo.");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useFocusEffect(refresh);

  return (
    <Screen>
      <Stack.Screen options={{ title: deck ? deck.name : "Ideas" }} />
      <FlatList
        data={ideas}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListEmptyComponent={<EmptyState text="Este mazo ya no tiene ideas." />}
        renderItem={({ item }) => (
          <Card
            level="high"
            onPress={() => router.push(`/mazos/${id}/tarjeta?cardId=${item.id}`)}
            style={styles.item}
          >
            <Text style={styles.front} numberOfLines={2}>
              {toPlainText(item.front)}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {toPlainText(item.back)}
            </Text>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleDateString("es-AR")}
            </Text>
            <Pressable
              onPress={() => router.push(`/gimnasio/charla?cardId=${item.id}`)}
              style={({ pressed }) => [styles.chatLink, pressed && { opacity: 0.65 }]}
            >
              <Feather name="message-circle" size={14} color={colors.accentText} />
              <Text style={styles.chatLinkText}>Ver la charla</Text>
            </Pressable>
          </Card>
        )}
      />
      <Toast
        message={loadError}
        onRetry={() => {
          setLoadError("");
          refresh();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  front: {
    ...type.body,
    ...font(500),
  },
  date: {
    ...type.small,
    fontSize: 11,
  },
  chatLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  chatLinkText: {
    ...type.small,
    ...font(600),
    color: colors.accentText,
  },
});
