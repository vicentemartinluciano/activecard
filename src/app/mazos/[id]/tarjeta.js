import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Collapsible from "../../../components/Collapsible";
import NotionField from "../../../components/NotionField";
import Toast from "../../../components/Toast";
import { Button, Chip, confirmAsync, Pill, Screen } from "../../../components/ui";
import {
  createCard,
  deleteCard,
  getCard,
  listRecentReviews,
  setCardDeck,
  setCardSuspended,
  updateCardText,
} from "../../../db/cards";
import { listDecks } from "../../../db/decks";
import { colors, font, spacing, type } from "../../../theme";

const RATING_LABEL = {
  good: "La recordé",
  hard: "Más o menos",
  again: "No la recordé",
};

function formatDate(value) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Crear o editar una tarjeta a mano. Sin cardId = nueva.
export default function EditorTarjeta() {
  const { id, cardId } = useLocalSearchParams();
  const deckId = Number(id);
  const router = useRouter();

  const [existing, setExisting] = useState(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [decks, setDecks] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      cardId ? getCard(Number(cardId)) : Promise.resolve(null),
      listDecks(),
      cardId ? listRecentReviews(Number(cardId), 5) : Promise.resolve([]),
    ])
      .then(([card, allDecks, reviews]) => {
        if (!alive) return;
        setDecks(allDecks);
        setRecentReviews(reviews);
        if (card) {
          setExisting(card);
          setFront(card.front);
          setBack(card.back);
        }
        setError("");
      })
      .catch(() => {
        if (alive) setError("No pudimos cargar los datos de la tarjeta.");
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
        await updateCardText(existing.id, front, back, { markReviewed: true });
      } else {
        await createCard({ deckId, front, back, source: "manual" });
      }
      if (router.canGoBack()) router.back();
      else router.replace(`/mazos/${deckId}`);
    } catch {
      setError("No pudimos guardar la tarjeta.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSuspended = async () => {
    if (!existing) return;
    const next = existing.suspended ? 0 : 1;
    if (next === 1) {
      const ok = await confirmAsync(
        "Suspender tarjeta",
        "Dejará de aparecer en repasos y progreso hasta que la reactives."
      );
      if (!ok) return;
    }
    try {
      await setCardSuspended(existing.id, next);
      setExisting((card) => ({ ...card, suspended: next }));
      setError("");
    } catch {
      setError("No pudimos cambiar el estado de la tarjeta.");
    }
  };

  const moveToDeck = async (targetDeckId) => {
    if (!existing || targetDeckId === existing.deck_id || saving) return;
    const target = decks.find((deck) => deck.id === targetDeckId);
    const ok = await confirmAsync(
      "Mover tarjeta",
      `Se moverá a "${target?.name || "otro mazo"}".`
    );
    if (!ok) return;
    if (!front.trim() || !back.trim()) {
      setError("Completá el frente y el dorso antes de moverla.");
      return;
    }
    setSaving(true);
    try {
      await updateCardText(existing.id, front, back, { markReviewed: true });
      await setCardDeck(existing.id, targetDeckId);
      router.replace(`/mazos/${targetDeckId}`);
    } catch {
      setError("No pudimos mover la tarjeta.");
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
        {existing?.suspended ? (
          <Pill icon="pause-circle" label="Suspendida" color={colors.textMuted} />
        ) : null}
        <View style={{ gap: spacing.sm }}>
          <Text style={type.small}>Frente (pregunta)</Text>
          <NotionField
            value={front}
            onChangeText={setFront}
            placeholder="¿Cuáles son las 5 fuerzas de Porter?"
            defaultAlign="center"
          />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Text style={type.small}>Dorso (respuesta)</Text>
          <NotionField
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
        {existing ? (
          <>
            <Button
              label={existing.suspended ? "Reactivar en el estudio" : "Suspender del estudio"}
              kind="ghost"
              onPress={toggleSuspended}
              disabled={saving}
            />

            <Collapsible
              icon="activity"
              title="Estado de aprendizaje"
              summary={`${existing.reps || 0} vistas · ${existing.lapses || 0} fallos`}
            >
              <View style={styles.metrics}>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Próxima aparición</Text>
                  <Text style={styles.metricValue}>
                    {existing.suspended ? "Suspendida" : formatDate(existing.due)}
                  </Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Veces vista</Text>
                  <Text style={styles.metricValue}>{existing.reps || 0}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Veces fallada</Text>
                  <Text style={styles.metricValue}>{existing.lapses || 0}</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricLabel}>Último repaso</Text>
                  <Text style={styles.metricValue}>{formatDate(existing.last_review)}</Text>
                </View>
              </View>

              <View style={{ gap: spacing.sm }}>
                <Text style={type.label}>Últimas notas</Text>
                {recentReviews.length > 0 ? (
                  recentReviews.map((review) => (
                    <View key={review.id} style={styles.reviewRow}>
                      <Text
                        style={[
                          styles.reviewRating,
                          review.rating === "again" && { color: colors.danger },
                        ]}
                      >
                        {RATING_LABEL[review.rating] || review.rating}
                      </Text>
                      <Text style={styles.reviewDate}>{formatDate(review.reviewed_at)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={type.small}>Todavía no tiene repasos.</Text>
                )}
              </View>
            </Collapsible>

            {decks.length > 1 ? (
              <Collapsible
                icon="folder"
                title="Mover a otro mazo"
                summary={decks.find((deck) => deck.id === existing.deck_id)?.name}
              >
                <View style={styles.deckRow}>
                  {decks.map((deck) => (
                    <Chip
                      key={deck.id}
                      label={deck.name}
                      active={deck.id === existing.deck_id}
                      onPress={() => moveToDeck(deck.id)}
                    />
                  ))}
                </View>
              </Collapsible>
            ) : null}

            <Button label="Borrar tarjeta" kind="danger" onPress={onDelete} />
          </>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
      <Toast message={error} onDismiss={() => setError("")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    gap: spacing.sm,
  },
  metric: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  metricLabel: {
    ...type.small,
  },
  metricValue: {
    ...type.small,
    ...font(600),
    color: colors.text,
    textAlign: "right",
    flexShrink: 1,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  reviewRating: {
    ...type.small,
    ...font(600),
    color: colors.successBright,
  },
  reviewDate: {
    ...type.small,
    fontSize: 11,
    textAlign: "right",
  },
  deckRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
