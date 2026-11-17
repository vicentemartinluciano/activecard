// Ideas de un mazo (Gimnasio Mental): filas de las tarjetas-idea reales.
// Tocar una abre el editor de la tarjeta — editar acá edita la tarjeta del
// mazo (es LA misma card). El useFocusEffect refresca al volver del editor.

import Feather from "@expo/vector-icons/Feather";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import BrainMark from "../../components/BrainMark";
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
    <Screen safeTop style={Platform.OS === "web" ? { maxWidth: 880, padding: 24 } : undefined}>
      <Stack.Screen options={{ title: deck ? deck.name : "Ideas", headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver a Ideas"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/gimnasio/ideas"))}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={23} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <BrainMark size={26} />
            <Text style={styles.headerTitle}>Gimnasio</Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {deck ? `Ideas · ${deck.name}` : "Ideas del mazo"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Historial de conversaciones"
          onPress={() => router.push("/gimnasio/historial")}
          style={styles.iconButton}
        >
          <Feather name="clock" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nueva conversación"
          onPress={() => router.push("/gimnasio/chat")}
          style={styles.iconButton}
        >
          <Feather name="edit-3" size={20} color={colors.text} />
        </Pressable>
      </View>
      <FlatList
        data={ideas}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, paddingBottom: spacing.xl }}
        ListEmptyComponent={<EmptyState text="Este mazo ya no tiene ideas." />}
        renderItem={({ item }) => (
          <Card
            level="high"
            style={styles.item}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Editar idea ${toPlainText(item.front)}`}
              onPress={() => router.push(`/mazos/${id}/tarjeta?cardId=${item.id}`)}
              style={({ pressed }) => [{ gap: spacing.xs }, pressed && { opacity: 0.75 }]}
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
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver la charla de esta idea"
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
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerTitle: {
    ...type.heading,
    fontSize: 22,
  },
  subtitle: {
    ...type.small,
    fontSize: 13,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(21,21,24,0.7)",
  },
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
    fontSize: 13,
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
