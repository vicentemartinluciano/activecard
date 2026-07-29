import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import NotionField from "../../components/NotionField";
import Toast from "../../components/Toast";
import { Button, Card, Chip, InlineAdd, Screen } from "../../components/ui";
import { createCard } from "../../db/cards";
import { createDeck, listDecks } from "../../db/decks";
import {
  clearDraft,
  getDraft,
  loadDraft,
  persistDraft,
} from "../../lib/draftStore";
import { toPlainText } from "../../lib/richtext";
import { colors, font, radius, spacing, type } from "../../theme";

// Preselección: revisar lo que propuso la IA antes de que toque el mazo.
// Cada tarjeta se puede descartar, editar con tus palabras, o agregar nuevas.
export default function Preseleccion() {
  const router = useRouter();
  const initialDraft = getDraft();

  const [draft, setDraftState] = useState(initialDraft);
  const [draftLoaded, setDraftLoaded] = useState(!!initialDraft);
  const [cards, setCards] = useState(() => initialDraft?.cards || []);
  const [editingKey, setEditingKey] = useState(null);
  const [decks, setDecks] = useState([]);
  const [deckId, setDeckId] = useState(initialDraft?.deckId ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (draftLoaded) return undefined;
    let alive = true;
    loadDraft()
      .then((stored) => {
        if (!alive) return;
        setDraftState(stored);
        setCards(stored?.cards || []);
        setDeckId(stored?.deckId ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setSaveError("No pudimos recuperar la preselección pendiente.");
      })
      .finally(() => {
        if (alive) setDraftLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [draftLoaded]);

  useEffect(() => {
    let alive = true;
    listDecks()
      .then((d) => {
        if (!alive) return;
        setDecks(d);
        setDeckId((current) => {
          if (current != null && d.some((deck) => deck.id === current)) return current;
          return d.length === 1 ? d[0].id : null;
        });
      })
      .catch(() => {
        if (alive) setSaveError("No pudimos cargar los mazos.");
      });
    return () => {
      alive = false;
    };
  }, []);

  const sourceLabel = draft?.sourceLabel;
  useEffect(() => {
    if (!draftLoaded || !sourceLabel || saving) return undefined;
    const timer = setTimeout(() => {
      persistDraft({ sourceLabel, cards, deckId }).catch(() => {
        setSaveError("No pudimos actualizar el borrador.");
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [cards, deckId, draftLoaded, saving, sourceLabel]);

  if (!draftLoaded) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Preselección" }} />
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={type.small}>Recuperando tu borrador…</Text>
      </Screen>
    );
  }

  if (!draft) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Preselección" }} />
        <Text style={type.body}>No hay tarjetas pendientes de revisar.</Text>
        <Button label="Crear tarjetas" kind="primary" onPress={() => router.replace("/crear")} />
        <Toast message={saveError} onDismiss={() => setSaveError("")} />
      </Screen>
    );
  }

  const keptCount = cards.filter((c) => c.kept).length;
  const pendingCount = cards.filter((c) => c.kept && !c.savedCardId).length;

  const toggleKept = (key) =>
    setCards((cs) =>
      cs.map((c) => (c.key === key && !c.savedCardId ? { ...c, kept: !c.kept } : c))
    );

  const editCard = (key, field, value) =>
    setCards((cs) =>
      cs.map((c) => (c.key === key && !c.savedCardId ? { ...c, [field]: value } : c))
    );

  const addManual = () =>
    setCards((cs) => [
      ...cs,
      {
        front: "",
        back: "",
        key: `manual-${Date.now()}`,
        kept: true,
        manual: true,
        savedCardId: null,
      },
    ]);

  const onCreateDeck = async (name) => {
    try {
      const id = await createDeck(name);
      setDecks(await listDecks());
      setDeckId(id);
      setSaveError("");
    } catch {
      setSaveError("No pudimos crear el mazo.");
    }
  };

  const save = async () => {
    if (!deckId || keptCount === 0 || saving) return;
    const incomplete = cards.some(
      (card) =>
        card.kept &&
        !card.savedCardId &&
        (!card.front.trim() || !card.back.trim())
    );
    if (incomplete) {
      setSaveError("Completá el frente y el dorso de todas las tarjetas elegidas.");
      return;
    }
    setSaving(true);
    setEditingKey(null);
    setSaveError("");
    let nextCards = cards;
    let savedNow = 0;
    try {
      for (const card of cards) {
        if (card.kept && !card.savedCardId) {
          const savedCardId = await createCard({
            deckId,
            front: card.front,
            back: card.back,
            source: card.manual ? "manual" : "ai",
          });
          savedNow += 1;
          nextCards = nextCards.map((candidate) =>
            candidate.key === card.key ? { ...candidate, savedCardId } : candidate
          );
          setCards(nextCards);
          // Persistir después de cada alta evita duplicar las ya guardadas si
          // la siguiente tarjeta falla y el usuario reintenta.
          await persistDraft({ sourceLabel: draft.sourceLabel, cards: nextCards, deckId });
        }
      }
      await clearDraft();
      router.replace(`/mazos/${deckId}`);
    } catch (error) {
      const detail = error?.message ? ` ${error.message}` : "";
      setSaveError(
        savedNow > 0
          ? `Se guardaron ${savedNow}; las restantes siguen en el borrador.${detail}`
          : `No pudimos guardar las tarjetas.${detail}`
      );
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
          <Card level="high" style={[styles.card, !item.kept && styles.cardDiscarded]}>
            {editingKey === item.key ? (
              <View style={{ gap: spacing.sm }}>
                {/* Solo la tarjeta en edición monta el editor → como máximo
                    2 WebViews vivos, nunca uno por tarjeta de la lista. */}
                <NotionField
                  value={item.front}
                  onChangeText={(v) => editCard(item.key, "front", v)}
                  placeholder="Frente (pregunta)"
                  minHeight={90}
                />
                <NotionField
                  value={item.back}
                  onChangeText={(v) => editCard(item.key, "back", v)}
                  placeholder="Dorso (respuesta)"
                  minHeight={90}
                />
                <Button label="Listo" kind="primary" onPress={() => setEditingKey(null)} />
              </View>
            ) : (
              <Pressable
                disabled={!!item.savedCardId}
                onPress={() => setEditingKey(item.key)}
              >
                <Text style={[styles.front, !item.kept && styles.textDiscarded]}>
                  {toPlainText(item.front) || "(sin frente — tocá para editar)"}
                </Text>
                <Text style={[type.small, !item.kept && styles.textDiscarded]} numberOfLines={3}>
                  {toPlainText(item.back) || "(sin dorso)"}
                </Text>
              </Pressable>
            )}
            <View style={styles.cardActions}>
              {item.savedCardId ? (
                <Text style={styles.savedLabel}>Guardada ✓</Text>
              ) : (
                <Button
                  label={item.kept ? "Descartar" : "Recuperar"}
                  kind={item.kept ? "ghost" : "primary"}
                  onPress={() => toggleKept(item.key)}
                />
              )}
            </View>
          </Card>
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
                  : pendingCount === 0
                    ? "Finalizar guardado"
                    : `Guardar ${pendingCount} ${pendingCount === 1 ? "tarjeta" : "tarjetas"}`
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
      <Toast message={saveError} onDismiss={() => setSaveError("")} />
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
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  cardDiscarded: {
    opacity: 0.5,
    backgroundColor: colors.bg,
  },
  front: {
    ...type.body,
    ...font(600),
    marginBottom: 4,
  },
  textDiscarded: {
    textDecorationLine: "line-through",
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  savedLabel: {
    ...type.small,
    color: colors.successBright,
    ...font(600),
  },
  deckRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
