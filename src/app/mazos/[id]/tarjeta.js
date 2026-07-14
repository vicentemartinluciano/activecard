import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";

import RichField from "../../../components/RichField";
import { Button, confirmAsync, Screen } from "../../../components/ui";
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
  const [saving, setSaving] = useState(false);

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
    if (!front.trim() || !back.trim() || saving) return;
    setSaving(true);
    try {
      if (existing) {
        await updateCardText(existing.id, front, back);
      } else {
        await createCard({ deckId, front, back, source: "manual" });
      }
      if (router.canGoBack()) router.back();
      else router.replace(`/mazos/${deckId}`);
    } finally {
      setSaving(false);
    }
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
      {/* Android usa adjustResize nativo fuera de Modals; el behavior padding es para iOS. */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
      <ScrollView
        contentContainerStyle={{ gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: spacing.sm }}>
          <Text style={type.small}>Frente (pregunta)</Text>
          <RichField
            value={front}
            onChangeText={setFront}
            placeholder="¿Cuáles son las 5 fuerzas de Porter?"
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={type.small}>Dorso (respuesta)</Text>
          <RichField
            value={back}
            onChangeText={setBack}
            placeholder="Competidores del sector, potenciales, sustitutos…"
          />
        </View>
        <Button
          label={saving ? "Guardando…" : existing ? "Guardar cambios" : "Crear tarjeta"}
          kind="primary"
          onPress={save}
          disabled={!front.trim() || !back.trim() || saving}
        />
        {existing ? <Button label="Borrar tarjeta" kind="danger" onPress={onDelete} /> : null}
      </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
