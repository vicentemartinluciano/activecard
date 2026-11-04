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

import CardActions from "../../../components/CardActions";
import { moveManagedCard, removeManagedCard } from "../../../lib/cardManagement";
import Collapsible from "../../../components/Collapsible";
import { useDesktopBeforeNavigate } from "../../../components/DesktopShell";
import useCardAutosaveLifecycle from "../../../components/useCardAutosaveLifecycle";
import EditableCardRow from "../../../components/EditableCardRow";
import { createCardAutosave, readCardDraft } from "../../../lib/cardAutosave";
import { useSyncRefresh } from "../../../components/useSyncRefresh";
import Toast from "../../../components/Toast";
import { EmptyState, Pill, Screen } from "../../../components/ui";
import {
  getCard,
  listRecentReviews,
  setCardSuspended,
} from "../../../db/cards";
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
  const navigationSavingRef = useRef(false);
  const autosaveRef = useRef(null);
  const draftRef = useRef({ front: "", back: "" });

  const [existing, setExisting] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const existingRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [recentReviews, setRecentReviews] = useState([]);
  const [error, setError] = useState("");
  const [syncReload, setSyncReload] = useState(0);
  useSyncRefresh(useCallback(() => setSyncReload((value) => value + 1), []));
  const dirty = front !== (existing?.front || '') || back !== (existing?.back || '');
  useFocusEffect(useCallback(() => { allowNavigation.current = false; }, []));

  const saveBeforeNavigate = useCallback(async () => {
    if (allowNavigation.current) return true;
    return autosaveRef.current ? autosaveRef.current.flush() : true;
  }, []);
  useCardAutosaveLifecycle(autosaveRef);
  const changeDraft = (next) => {
    allowNavigation.current = false;
    draftRef.current = next;
    setFront(next.front); setBack(next.back);
    autosaveRef.current?.change(next);
  };
  useDesktopBeforeNavigate(saveBeforeNavigate);
  useEffect(() => {
    return navigation.addListener('beforeRemove', (event) => {
      if (!dirty || allowNavigation.current) return;
      event.preventDefault();
      if (navigationSavingRef.current) return;
      navigationSavingRef.current = true;
      saveBeforeNavigate().then((saved) => { if (saved) { allowNavigation.current = true; navigation.dispatch(event.data.action); } })
        .finally(() => { navigationSavingRef.current = false; });
    });
  }, [navigation, dirty, saveBeforeNavigate]);

  useEffect(() => {
    let alive = true;
    if (syncReload > 0 && dirty) { setError("La biblioteca se actualizó. Conservamos tu edición; revisá la tarjeta antes de guardarla."); return; }
    const targetId = cardId || (syncReload > 0 ? existing?.id : null);
    Promise.all([
      targetId ? getCard(Number(targetId)) : Promise.resolve(null),
      targetId ? listRecentReviews(Number(targetId), 5) : Promise.resolve([]),
    ])
      .then(async ([card, reviews]) => {
        if (!alive) return;
        if (targetId && !card) { setError("Esta tarjeta se eliminó en otro dispositivo. La copia anterior está en Recuperación."); return; }
        setRecentReviews(reviews);
        if (card) {
          existingRef.current = card; setExisting(card);
          setFront(card.front);
          setBack(card.back);
        }
        const restored = await readCardDraft(deckId, card?.id);
        if (!alive) return;
        const draft = restored || card || { front: "", back: "" };
        draftRef.current = draft; setFront(draft.front); setBack(draft.back);
        autosaveRef.current = createCardAutosave({ deckId, card, restored,
          onSaved: (saved) => { existingRef.current = { ...existingRef.current, id: saved.id, deck_id: saved.deck_id, front: saved.front, back: saved.back, source: saved.source }; setExisting(existingRef.current); },
          onStatus: (_status, message) => setError(message || ""),
        });
        if (restored) autosaveRef.current.change(draft);
        setLoaded(true);
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

  const resolveCard = () => existingRef.current || { id: "new", deck_id: deckId, ...draftRef.current };
  const toggleSuspended = async () => {
    const current = existingRef.current;
    if (!current) return;
    const suspended = current.suspended ? 0 : 1;
    await setCardSuspended(current.id, suspended);
    existingRef.current = { ...existingRef.current, suspended };
    setExisting(existingRef.current);
  };
  const leaveAfterOperation = (route) => {
    autosaveRef.current = null; allowNavigation.current = true;
    router.replace(route);
  };
  const remove = async () => {
    await removeManagedCard({ deckId, autosave: autosaveRef.current, resolveCard });
    leaveAfterOperation(`/mazos/${deckId}`);
  };
  const move = async (_card, targetDeckId) => {
    await moveManagedCard({ autosave: autosaveRef.current, resolveCard, targetDeckId });
    leaveAfterOperation(`/mazos/${targetDeckId}`);
  };

  if (!loaded) return <Screen><Stack.Screen options={{ title: "Tarjeta" }} /><EmptyState text={error || "Cargando tarjeta…"} /><Toast message={error} /></Screen>;

  return (
    <Screen style={Platform.OS === 'web' ? { maxWidth: '100%', paddingHorizontal: 20 } : undefined}>
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
        <EditableCardRow card={existing || { id: "new", source: "manual" }} index={0} total={1} active
          draft={{ front, back }} onChangeDraft={changeDraft} onOptions={() => setMenuOpen(true)} />
        {existing ? (
          <>
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

          </>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>
      <CardActions card={menuOpen ? resolveCard() : null} onClose={() => setMenuOpen(false)} onDelete={remove} onMove={move} onSuspend={toggleSuspended} onError={setError} />
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
    fontSize: 13,
    textAlign: "right",
  },
  deckRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
