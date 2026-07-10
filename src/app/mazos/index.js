import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { EmptyState, InlineAdd, Screen } from "../../components/ui";
import { createDeck, listDecks } from "../../db/decks";
import { colors, radius, spacing, type } from "../../theme";

export default function Mazos() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);

  const refresh = useCallback(() => {
    let alive = true;
    listDecks().then((d) => alive && setDecks(d));
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(refresh);

  const onCreate = async (name) => {
    const id = await createDeck(name);
    router.push(`/mazos/${id}`);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Mazos" }} />
      <InlineAdd placeholder="Nombre del mazo nuevo…" buttonLabel="Crear" onSubmit={onCreate} />
      <FlatList
        data={decks}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.sm }}
        ListEmptyComponent={
          <EmptyState text="Todavía no hay mazos. Creá el primero arriba." />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/mazos/${item.id}`)}
            style={({ pressed }) => [styles.deck, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.deckName}>{item.name}</Text>
              <Text style={type.small}>
                {item.card_count} {item.card_count === 1 ? "tarjeta" : "tarjetas"}
                {item.tags.length > 0 ? ` · ${item.tags.map((t) => t.name).join(", ")}` : ""}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  deck: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  deckName: {
    ...type.body,
    fontWeight: "600",
    marginBottom: 2,
  },
});
