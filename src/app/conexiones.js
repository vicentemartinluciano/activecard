import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { EmptyState, Screen } from "../components/ui";
import { listConnections } from "../db/connections";
import { colors, radius, spacing, type } from "../theme";

// Archivo de conexiones validadas por el Auditor: el registro del criterio propio.
export default function Conexiones() {
  const [connections, setConnections] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listConnections().then((c) => alive && setConnections(c));
      return () => {
        alive = false;
      };
    }, [])
  );

  return (
    <Screen>
      <Stack.Screen options={{ title: "Conexiones creadas" }} />
      <FlatList
        data={connections}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <EmptyState text="Todavía no validaste ninguna conexión en el Gimnasio Mental." />
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={type.small}>Sobre: {item.card_front}</Text>
            <Text style={styles.text}>{item.final_text}</Text>
            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString("es-AR")}</Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  text: {
    ...type.body,
    fontSize: 15,
  },
  date: {
    ...type.small,
    fontSize: 11,
  },
});
