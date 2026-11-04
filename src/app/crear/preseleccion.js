import { Stack, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import DeckPicker from "../../components/DeckPicker";
import RichText from "../../components/RichText";
import NotionField from "../../components/NotionField";
import Toast from "../../components/Toast";
import { Button, Card, Chip, Field, Screen } from "../../components/ui";
import { createCard } from "../../db/cards";
import { createDeck, listDecks } from "../../db/decks";
import { listFolders } from "../../db/folders";
import FolderPicker from "../../components/FolderPicker";
import { hasRichContent } from "../../lib/richtext";
import {
  DRAFT_KEY,
  clearDraft,
  getDraft,
  loadDraft,
  persistDraft,
} from "../../lib/draftStore";
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
          return current != null || getDraft()?.createNewDeck ? current : d.length === 1 ? d[0].id : null;
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
        (!hasRichContent(card.front) || !hasRichContent(card.back))
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
      if (targetId && !(await listDecks()).some((deck) => deck.id === targetId)) throw new Error("El mazo de destino ya no existe. Elegí otro mazo.");
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
            generationDraft: { key: DRAFT_KEY, cardKey: card.key, value: { sourceLabel: draft.sourceLabel, cards: nextCards, deckId: targetId, folderId, createNewDeck, newDeckName } },
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
          <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
            <Text style={type.label}>{keptCount} de {cards.length} tarjetas elegidas</Text>
            <Text style={type.small}>De: {draft.sourceLabel}. Tocá el contenido para editar; descartá lo que no sirva.</Text>
            <View style={{ gap: spacing.sm }}>
              <Text style={type.label}>Guardar las tarjetas elegidas</Text>
              {!cards.some((c) => c.savedCardId) && !deckId && <View style={styles.deckRow}>
                <Chip label="Nuevo mazo" active={createNewDeck} onPress={() => setCreateNewDeck(true)} />
                <Chip label="Mazo existente" active={!createNewDeck} onPress={() => setCreateNewDeck(false)} />
              </View>}
              {createNewDeck ? <>
                <Field accessibilityLabel="Nombre del nuevo mazo" placeholder="Nombre del nuevo mazo…" value={newDeckName} onChangeText={setNewDeckName} editable={!saving && !deckId} />
                <FolderPicker folders={folders} value={folderId} onChange={setFolderId} disabled={saving || !!deckId || !locationsLoaded} />
              </> : <View style={{ gap: spacing.sm }}>
                <DeckPicker decks={decks} folders={folders} value={deckId} onChange={setDeckId} disabled={saving || cards.some((card) => card.savedCardId)} />
                {!cards.some((c) => c.savedCardId) && <Button label="Crear un mazo nuevo" kind="ghost" onPress={() => { setDeckId(null); setCreateNewDeck(true); }} />}
              </View>}

            </View>

          </View>
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
                disabled={saving || !!item.savedCardId}
                onPress={() => setEditingKey(item.key)}
              >
                <RichText text={item.front || '(sin frente — tocá para editar)'} style={[styles.front, !item.kept && styles.textDiscarded]} />
                <RichText text={item.back || '(sin dorso)'} style={[type.body, !item.kept && styles.textDiscarded]} />
              </Pressable>
            )}
            <View style={styles.cardActions}>
              {item.savedCardId ? (
                <Text style={styles.savedLabel}>Guardada ✓</Text>
              ) : (
                <Button
                  label={item.kept ? "Descartar" : "Recuperar"}
                  kind={item.kept ? "ghost" : "primary"}
                  disabled={saving}
                  onPress={() => toggleKept(item.key)}
                />
              )}
            </View>
          </Card>
        )}
        ListFooterComponent={
          <View style={{ gap: spacing.lg, marginTop: spacing.md }}>
            <Button label="Agregar tarjeta a mano" kind="ghost" disabled={saving} onPress={addManual} />

          </View>
        }
      />
      <View style={{ paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
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
      </View>
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
