import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { Button, confirmAsync, Field, Screen } from "../../../components/ui";
import { createCard, deleteCard, getCard, updateCardText } from "../../../db/cards";
import { spacing, type } from "../../../theme";

// Crear o editar una tarjeta a mano. Sin cardId = nueva.
export default function EditorTarjeta() {
  const { id, cardId } = useLocalSearchParams();
  const deckId = Number(id);
  const router = useRouter();

  const [existing, setExisting] = useState(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");

  useEffect(() => {
    if (!cardId) return;
    let alive = true;
    getCard(Number(cardId)).then((c) => {
      if (alive && c) {
        setExisting(c);
        setFront(c.front);
        setBack(c.back);
      }
    });
    return () => {
      alive = false;
    };
  }, [cardId]);

  const save = async () => {
    if (!front.trim() || !back.trim()) return;
    if (existing) {
      await updateCardText(existing.id, front, back);
    } else {
      await createCard({ deckId, front, back, source: "manual" });
    }
    router.back();
  };

  const onDelete = async () => {
    const ok = await confirmAsync("Borrar tarjeta", "No se puede deshacer.");
    if (ok) {
      await deleteCard(existing.id);
      router.back();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? "Editar tarjeta" : "Nueva tarjeta" }} />
      <ScrollView contentContainerStyle={{ gap: spacing.md }}>
        <View style={{ gap: spacing.sm }}>
          <Text style={type.small}>Frente (pregunta)</Text>
          <Field
            value={front}
            onChangeText={setFront}
            placeholder="¿Cuáles son las 5 fuerzas de Porter?"
            multiline
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={type.small}>Dorso (respuesta)</Text>
          <Field
            value={back}
            onChangeText={setBack}
            placeholder="Competidores del sector, potenciales, sustitutos…"
            multiline
          />
        </View>
        <Button
          label={existing ? "Guardar cambios" : "Crear tarjeta"}
          kind="primary"
          onPress={save}
          disabled={!front.trim() || !back.trim()}
        />
        {existing ? <Button label="Borrar tarjeta" kind="danger" onPress={onDelete} /> : null}
      </ScrollView>
    </Screen>
  );
}
