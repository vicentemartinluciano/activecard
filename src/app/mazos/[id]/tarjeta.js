import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import Collapsible from "../../../components/Collapsible";
import { useDesktopBeforeNavigate } from "../../../components/DesktopShell";
import NotionField from "../../../components/NotionField";
import { useSyncRefresh } from "../../../components/useSyncRefresh";
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
  const navigation = useNavigation();
  const allowNavigation = useRef(false);
  const savingNavigation = useRef(false);

  const [existing, setExisting] = useState(null);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [saving, setSaving] = useState(false);
  const [decks, setDecks] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [error, setError] = useState("");
  const [syncReload, setSyncReload] = useState(0);
  useSyncRefresh(useCallback(() => setSyncReload((value) => value + 1), []));
  const dirty = front !== (existing?.front || '') || back !== (existing?.back || '');
  useFocusEffect(useCallback(() => { allowNavigation.current = false; }, []));

  const saveBeforeNavigate = useCallback(async () => {
    if (!dirty || allowNavigation.current) return true;
    if (saving || savingNavigation.current) return false;
    if (!front.trim() || !back.trim()) { setError('Completá el frente y el dorso antes de salir.'); return false; }
    savingNavigation.current = true;
    try {
      if (existing) {
        await updateCardText(existing.id, front, back, { markReviewed: true, expected: existing });
        setExisting({ ...existing, front, back });
      } else {
        const createdId = await createCard({ deckId, front, back, source: 'manual' });
        // Keep the new identity when another Stack screen covers this editor.
        setExisting({ id: createdId, deck_id: deckId, front, back, source: 'manual' });
        const created = await getCard(createdId);
        if (created) setExisting({ ...created, front, back });
      }
      allowNavigation.current = true;
      return true;
    } catch { setError('No pudimos guardar la tarjeta. Volvé a intentar.'); return false; }
    finally { savingNavigation.current = false; }
  }, [dirty, saving, front, back, existing, deckId]);
  useDesktopBeforeNavigate(saveBeforeNavigate);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    return navigation.addListener('beforeRemove', (event) => {
      if (!dirty || allowNavigation.current) return;
      event.preventDefault();
      saveBeforeNavigate().then((saved) => { if (saved) navigation.dispatch(event.data.action); });
    });
  }, [navigation, dirty, saveBeforeNavigate]);
  useEffect(() => {
    if (Platform.OS !== 'web' || !dirty) return;
    const warn = (event) => { if (!allowNavigation.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    let alive = true;
    if (syncReload > 0 && dirty) { setError("La biblioteca se actualizó. Conservamos tu edición; revisá la tarjeta antes de guardarla."); return; }
    const targetId = cardId || (syncReload > 0 ? existing?.id : null);
    Promise.all([
      targetId ? getCard(Number(targetId)) : Promise.resolve(null),
      listDecks(),
      targetId ? listRecentReviews(Number(targetId), 5) : Promise.resolve([]),
    ])
      .then(([card, allDecks, reviews]) => {
        if (!alive) return;
        if (targetId && !card) { setError("Esta tarjeta se eliminó en otro dispositivo. La copia anterior está en Recuperación."); return; }
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
  // dirty se evalúa al recibir una nueva biblioteca; escribir no recarga el editor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId, syncReload]);

  const save = async () => {
    if (!front.trim() || !back.trim() || saving) return;
    setSaving(true);
    try {
      if (existing) {
        await updateCardText(existing.id, front, back, { markReviewed: true, expected: existing });
      } else {
        await createCard({ deckId, front, back, source: "manual" });
      }
      allowNavigation.current = true;
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
      await updateCardText(existing.id, front, back, { markReviewed: true, expected: existing });
      await setCardDeck(existing.id, targetDeckId);
      allowNavigation.current = true;
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
      allowNavigation.current = true;
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
        <View style={styles.editorFields}>
        <View style={styles.editorField}>
          <Text style={type.small}>Frente (pregunta)</Text>
          <NotionField
            value={front}
            onChangeText={setFront}
            placeholder="¿Cuáles son las 5 fuerzas de Porter?"
            defaultAlign="center"
          />
        </View>
        <View style={styles.editorField}>
          <Text style={type.small}>Dorso (respuesta)</Text>
          <NotionField
            value={back}
            onChangeText={setBack}
            placeholder="Competidores del sector, potenciales, sustitutos…"
          />
        </View>
        </View>
        <Button
          label={saving ? "Guardando…" : existing ? "Guardar cambios" : "Crear tarjeta"}
          kind="primary"
          onPress={save}
          disabled={!front.trim() || !back.trim() || saving}
        />
        {Platform.OS === 'web' && dirty && <Button label="Descartar cambios" kind="ghost" onPress={async () => {
          if (!await confirmAsync('Descartar cambios', 'Se perderá el texto que todavía no guardaste.')) return;
          allowNavigation.current = true;
          if (router.canGoBack()) router.back(); else router.replace(`/mazos/${deckId}`);
        }} />}
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
  // El wrap y las bases flex son para las columnas web. En Yoga nativo,
  // envolver una columna impide que los campos se estiren al ancho disponible.
  editorFields: {
    gap: spacing.md,
    ...(Platform.OS === 'web'
      ? { flexDirection: 'row', flexWrap: 'wrap' }
      : { flexDirection: 'column', alignItems: 'stretch', width: '100%' }),
  },
  editorField: {
    gap: spacing.sm,
    ...(Platform.OS === 'web'
      ? { flexGrow: 1, flexShrink: 1, flexBasis: 320, minWidth: 0 }
      : { width: '100%' }),
  },
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
