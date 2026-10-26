import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import NotionField from "../../components/NotionField";
import Toast from "../../components/Toast";
import { Button, Card, Chip, Field, Screen } from "../../components/ui";
import { createCard } from "../../db/cards";
import { createDeck, listDecks } from "../../db/decks";
import { listFolders } from "../../db/folders";
import FolderPicker from "../../components/FolderPicker";
import { locationLabel } from "../../lib/libraryLocation";
import {
  DRAFT_KEY,
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
  const [folderId, setFolderId] = useState(initialDraft?.folderId ?? null);
  const [newDeckName, setNewDeckName] = useState(initialDraft?.newDeckName || '');
  const [createNewDeck, setCreateNewDeck] = useState(!!initialDraft?.createNewDeck);
  const [folders, setFolders] = useState([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);
  const saveLock = useRef(false);
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
        setFolderId(stored?.folderId ?? null);
        setNewDeckName(stored?.newDeckName || '');
        setCreateNewDeck(!!stored?.createNewDeck);
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
    Promise.all([listDecks(), listFolders()])
      .then(([d, f]) => {
        if (!alive) return;
        setDecks(d); setFolders(f); setLocationsLoaded(true);
        setDeckId((current) => {
          if (current != null && d.some((deck) => deck.id === current)) return current;
          return getDraft()?.createNewDeck ? null : d.length === 1 ? d[0].id : null;
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
      persistDraft({ sourceLabel, cards, deckId, folderId, createNewDeck, newDeckName }).catch(() => {
        setSaveError("No pudimos actualizar el borrador.");
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [cards, deckId, folderId, createNewDeck, newDeckName, draftLoaded, saving, sourceLabel]);

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

  const save = async () => {
    if (saveLock.current || keptCount === 0 || saving || (!createNewDeck && !deckId) || (createNewDeck && !deckId && !newDeckName.trim())) return;
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
    saveLock.current = true;
    setSaving(true);
    setEditingKey(null);
    setSaveError("");
    let nextCards = cards;
    let savedNow = 0;
    let targetId = deckId;
    try {
      if (createNewDeck && !targetId) {
        const snapshot = { sourceLabel: draft.sourceLabel, cards, folderId, createNewDeck, newDeckName };
        targetId = await createDeck(newDeckName, folderId, { draftKey: DRAFT_KEY, draft: snapshot });
        setDeckId(targetId);
        await persistDraft({ ...snapshot, deckId: targetId });
      }
      for (const card of cards) {
        if (card.kept && !card.savedCardId) {
          const savedCardId = await createCard({
            deckId: targetId,
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
          await persistDraft({ sourceLabel: draft.sourceLabel, cards: nextCards, deckId: targetId, folderId, createNewDeck, newDeckName });
        }
      }
      await clearDraft();
      const parentId = createNewDeck ? folderId : decks.find((d) => d.id === targetId)?.folder_id;
      router.dismissTo(parentId == null ? '/biblioteca' : `/carpetas/${parentId}`);
      router.push(`/mazos/${targetId}`);
    } catch (error) {
      try { setFolders(await listFolders()); } catch { /* Mantener el error original. */ }
      const detail = error?.message ? ` ${error.message}` : "";
      setSaveError(
        savedNow > 0
          ? `Se guardaron ${savedNow}; las restantes siguen en el borrador.${detail}`
          : `No pudimos guardar las tarjetas.${detail}`
      );
    } finally {
      saveLock.current = false; setSaving(false);
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
              <Text style={type.label}>Guardar las tarjetas elegidas</Text>
              {!cards.some((c) => c.savedCardId) && !deckId && <View style={styles.deckRow}>
                <Chip label="Nuevo mazo" active={createNewDeck} onPress={() => setCreateNewDeck(true)} />
                <Chip label="Mazo existente" active={!createNewDeck} onPress={() => setCreateNewDeck(false)} />
              </View>}
              {createNewDeck ? <>
                <Field accessibilityLabel="Nombre del nuevo mazo" placeholder="Nombre del nuevo mazo…" value={newDeckName} onChangeText={setNewDeckName} editable={!saving && !deckId} />
                <FolderPicker folders={folders} value={folderId} onChange={setFolderId} disabled={saving || !!deckId || !locationsLoaded} />
              </> : <View style={styles.deckRow}>
                {decks.map((d) => <Chip key={d.id} label={`${d.name} · ${locationLabel(folders, d.folder_id)}`} active={deckId === d.id} onPress={() => { if (!saving && !cards.some((c) => c.savedCardId)) setDeckId(d.id); }} />)}
                {!cards.some((c) => c.savedCardId) && <Button label="Crear un mazo nuevo" onPress={() => { setDeckId(null); setCreateNewDeck(true); }} />}
              </View>}

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
              disabled={(!deckId && (!createNewDeck || !newDeckName.trim())) || keptCount === 0 || saving || !locationsLoaded || (createNewDeck && !deckId && folderId != null && !folders.some((f) => f.id === folderId))}
            />
            {!deckId && !createNewDeck ? (
              <Text style={type.small}>Elegí un mazo para poder guardar.</Text>
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
