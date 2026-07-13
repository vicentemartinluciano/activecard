// Carpeta virtual "Gimnasio Mental": lista los mazos que tienen conexiones
// validadas por el Auditor. No es una fila de `folders` — se deriva en vivo
// de `connections`, no se puede borrar/renombrar y no viaja en el backup.

import { Feather } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { Button, Card, EmptyState, Pill, Screen } from "../../components/ui";
import { listDecksWithConnections } from "../../db/connections";
import { colors, spacing, type } from "../../theme";

export default function GimnasioMental() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listDecksWithConnections().then((d) => alive && setDecks(d));
      return () => {
        alive = false;
      };
    }, [])
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: "Gimnasio Mental" }} />
      <FlatList
        data={decks}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <EmptyState text="Todavía no hay conexiones validadas en ningún mazo." />
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/conexiones?deckId=${item.id}`)} style={styles.row}>
            <Feather name={item.icon || "layers"} size={20} color={colors.accentText} />
            <View style={{ flex: 1 }}>
              <Text style={type.body} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={type.small}>
                Última conexión: {new Date(item.last_connection_at).toLocaleDateString("es-AR")}
              </Text>
            </View>
            <Pill
              label={`${item.connection_count} ${item.connection_count === 1 ? "conexión" : "conexiones"}`}
            />
          </Card>
        )}
        ListFooterComponent={
          decks.length > 0 ? (
            <Button
              label="Ver todas las conexiones"
              kind="ghost"
              onPress={() => router.push("/conexiones")}
              style={{ marginTop: spacing.md }}
            />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
