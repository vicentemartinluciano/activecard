import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import PercentSlider from "../components/PercentSlider";
import { Button, Screen } from "../components/ui";
import { listDecks, updateDeckPriority } from "../db/decks";
import { spacing, type } from "../theme";

export default function Ajustes() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);

  const load = useCallback(async () => {
    setDecks(await listDecks());
  }, []);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  useFocusEffect(refresh);

  const changePriority = async (deckId, priority) => {
    await updateDeckPriority(deckId, priority);
    load();
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ajustes" }} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prioridad de los mazos</Text>
          <Text style={type.small}>
            El porcentaje define cuánta presencia tiene cada mazo en el repaso diario. 0% lo
            pausa (no aparece hasta que lo subas; igual podés estudiarlo desde la Biblioteca).
          </Text>
          {decks.length === 0 ? (
            <Text style={[type.small, { marginTop: spacing.sm }]}>
              Creá mazos para poder priorizarlos.
            </Text>
          ) : null}
          {decks.map((d) => (
            <View key={d.id} style={styles.priorityItem}>
              <Text style={type.body}>{d.name}</Text>
              <PercentSlider value={d.priority} onChange={(p) => changePriority(d.id, p)} />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gimnasio Mental</Text>
          <Button label="Ver conexiones creadas" onPress={() => router.push("/conexiones")} />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.body,
    fontWeight: "700",
  },
  priorityItem: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
