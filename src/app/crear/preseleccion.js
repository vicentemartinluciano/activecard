import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Button, Chip, Field, InlineAdd, Screen } from "../../components/ui";
import { createCard } from "../../db/cards";
import { createDeck, listDecks } from "../../db/decks";
import { clearDraft, getDraft } from "../../lib/draftStore";
import { colors, radius, spacing, type } from "../../theme";

// Preselección: revisar lo que propuso la IA antes de que toque el mazo.
// Cada tarjeta se puede descartar, editar con tus palabras, o agregar nuevas.
export default function Preseleccion() {
  const router = useRouter();
  const draft = getDraft();

  const [cards, setCards] = useState(() =>
    draft ? draft.cards.map((c, i) => ({ ...c, key: i, kept: true })) : []
  );
  const [editingKey, setEditingKey] = useState(null);
  const [decks, setDecks] = useState([]);
  const [deckId, setDeckId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    listDecks().then((d) => {
      if (!alive) return;
      setDecks(d);
      if (d.length === 1) setDeckId(d[0].id);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!draft) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Preselección" }} />
        <Text style={type.body}>No hay tarjetas pendientes de revisar.</Text>
        <Button label="Crear tarjetas" kind="primary" onPress={() => router.replace("/crear")} />
      </Screen>
    );
  }

  const keptCount = cards.filter((c) => c.kept).length;

  const toggleKept = (key) =>
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, kept: !c.kept } : c)));

  const editCard = (key, field, value) =>
    setCards((cs) => cs.map((c) => (c.key === key ? { ...c, [field]: value } : c)));

  const addManual = () =>
    setCards((cs) => [
      ...cs,
      { front: "", back: "", key: Date.now(), kept: true, manual: true },
    ]);

  const onCreateDeck = async (name) => {
    const id = await createDeck(name);
    setDecks(await listDecks());
    setDeckId(id);
  };

  const save = async () => {
    if (!deckId || keptCount === 0 || saving) return;
    setSaving(true);
    try {
      for (const c of cards) {
        if (c.kept && c.front.trim() && c.back.trim()) {
          await createCard({
            deckId,
            front: c.front,
            back: c.back,
            source: c.manual ? "manual" : "ai",
          });
        }
      }
      clearDraft();
      router.replace(`/mazos/${deckId}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: `Preselección (${keptCount})` }} />
      <FlatList
        data={cards}
        keyExtractor={(c) => String(c.key)}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <Text style={[type.small, { marginBottom: spacing.sm }]}>
            De: {draft.sourceLabel}. Tocá una tarjeta para editarla con tus palabras; descartá
            las que no sirvan.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.kept && styles.cardDiscarded]}>
            {editingKey === item.key ? (
              <View style={{ gap: spacing.sm }}>
                <Field
                  value={item.front}
                  onChangeText={(v) => editCard(item.key, "front", v)}
                  placeholder="Frente (pregunta)"
                  multiline
                />
                <Field
                  value={item.back}
                  onChangeText={(v) => editCard(item.key, "back", v)}
                  placeholder="Dorso (respuesta)"
                  multiline
                />
                <Button label="Listo" kind="primary" onPress={() => setEditingKey(null)} />
              </View>
            ) : (
              <Pressable onPress={() => setEditingKey(item.key)}>
                <Text style={[styles.front, !item.kept && styles.textDiscarded]}>
                  {item.front || "(sin frente — tocá para editar)"}
                </Text>
                <Text style={[type.small, !item.kept && styles.textDiscarded]} numberOfLines={3}>
                  {item.back || "(sin dorso)"}
                </Text>
              </Pressable>
            )}
            <View style={styles.cardActions}>
              <Button
                label={item.kept ? "Descartar" : "Recuperar"}
                kind={item.kept ? "ghost" : "primary"}
                onPress={() => toggleKept(item.key)}
              />
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
            <Button label="Agregar tarjeta a mano" kind="ghost" onPress={addManual} />

            <View style={{ gap: spacing.sm }}>
              <Text style={type.small}>Guardar en el mazo:</Text>
              <View style={styles.deckRow}>
                {decks.map((d) => (
                  <Chip
                    key={d.id}
                    label={d.name}
                    active={deckId === d.id}
                    onPress={() => setDeckId(d.id)}
                  />
                ))}
              </View>
              <InlineAdd placeholder="O crear mazo nuevo…" buttonLabel="Crear" onSubmit={onCreateDeck} />
            </View>

            <Button
              label={
                saving
                  ? "Guardando…"
                  : `Guardar ${keptCount} ${keptCount === 1 ? "tarjeta" : "tarjetas"}`
              }
              kind="primary"
              onPress={save}
              disabled={!deckId || keptCount === 0 || saving}
            />
            {!deckId ? (
              <Text style={type.small}>Elegí o creá un mazo para poder guardar.</Text>
            ) : null}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardDiscarded: {
    opacity: 0.5,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  front: {
    ...type.body,
    fontWeight: "600",
    marginBottom: 4,
  },
  textDiscarded: {
    textDecorationLine: "line-through",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  deckRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
