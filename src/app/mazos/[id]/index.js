import Feather from "@expo/vector-icons/Feather";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Sortable from "react-native-sortables";

import ActionSheet from "../../../components/ActionSheet";
import Collapsible from "../../../components/Collapsible";
import ConfirmDeleteSheet from "../../../components/ConfirmDeleteSheet";
import EditableCardRow from "../../../components/EditableCardRow";
import GlowPressable from "../../../components/GlowPressable";
import IconPicker from "../../../components/IconPicker";
import PercentSlider from "../../../components/PercentSlider";
import ProgressBar from "../../../components/ProgressBar";
import Stagger from "../../../components/Stagger";
import Toast from "../../../components/Toast";
import { Button, Card, Chip, confirmAsync, EmptyState, Field, InlineAdd, Pill, Screen } from "../../../components/ui";
import { useDesktopBeforeNavigate } from "../../../components/DesktopShell";
import {
  listCardsByDeck,
  createCard,
  getCard,
  setCardPositions,
  setCardStarred,
  setCardSuspended,
  updateCardText,
} from "../../../db/cards";
import {
  deleteDeck,
  ensureTag,
  getDeck,
  listTags,
  renameDeck,
  setDeckFolder,
  setDeckTags,
  updateDeckIcon,
  updateDeckPriority,
} from "../../../db/decks";
import { listFolders } from "../../../db/folders";
import { getDeckDailyProgress } from "../../../db/progress";
import { getDeckRecallScore } from "../../../db/stats";
import { getSetting, setSetting } from "../../../db/settings";
import { toPlainText } from "../../../lib/richtext";
import { exportDeck } from "../../../lib/backupIO";
import { folderPath } from "../../../lib/folderTree";
import { filterDeckCards } from "../../../lib/search";
import { colors, font, glow, gradients, radius, spacing, textColors, type } from "../../../theme";

// Botón destacado con la visual del hero de Inicio (degradado azul).
// Se usa arriba del mazo y como "Empezar" del sheet de estudio. El halo cobalto
// aparece SOLO al tocarlo (o con el mouse encima en la web).
export function HeroButton({ label, onPress, style }) {
  return (
    <GlowPressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.heroBtnOuter, style]}>
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBtn}
      >
        <Text style={styles.heroBtnLabel}>{label}</Text>
      </LinearGradient>
    </GlowPressable>
  );
}

function StarToggle({ starred, onPress, size = 18 }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={starred ? "Quitar de destacadas" : "Destacar tarjeta"} accessibilityState={{ selected: !!starred }} onPress={onPress} hitSlop={2} style={styles.cardAction}>
      {starred ? (
        <FontAwesome name="star" size={size} color="#FFC53D" />
      ) : (
        <Feather name="star" size={size} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

function SuspendToggle({ suspended, onPress, size = 18 }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={suspended ? "Reanudar tarjeta" : "Suspender tarjeta"} accessibilityState={{ selected: !!suspended }} onPress={onPress} hitSlop={2} style={styles.cardAction}>
      <Feather
        name={suspended ? "play-circle" : "pause-circle"}
        size={size}
        color={suspended ? colors.accentText : colors.textMuted}
      />
    </Pressable>
  );
}

export default function DetalleMazo() {
  const { id } = useLocalSearchParams();
  const deckId = Number(id);
  const router = useRouter();
  const navigation = useNavigation();

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [folders, setFolders] = useState([]);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [progress, setProgress] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [studySheet, setStudySheet] = useState(false);
  const [starsOnly, setStarsOnly] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [recallScore, setRecallScore] = useState(null);
  // Modo edición: todas las tarjetas abiertas, se editan sin entrar a cada una.
  // activeId es la única que monta editores de verdad (ver EditableCardRow).
  const [editMode, setEditMode] = useState(true);
  const [twoColumns, setTwoColumns] = useState(false);
  const [cardsWidth, setCardsWidth] = useState(0);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState({ front: "", back: "" });
  const [editError, setEditError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadedDeckId, setLoadedDeckId] = useState(null);
  const [cardQuery, setCardQuery] = useState("");
  const [cardFilter, setCardFilter] = useState(null);
  // Los chips de filtro solo se muestran con el buscador enfocado, igual que
  // las etiquetas de Biblioteca: la lista de tarjetas empieza más arriba.
  const [cardSearchFocused, setCardSearchFocused] = useState(false);
  const allowNavigationRef = useRef(false);
  const savingDraftRef = useRef(false);
  const cardsRef = useRef(cards);
  const activeIdRef = useRef(activeId);
  const draftRef = useRef(draft);
  const commitInFlightRef = useRef(null);

  useEffect(() => {
    cardsRef.current = cards;
  }, [cards]);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const load = useCallback(async () => {
    try {
      const d = await getDeck(deckId);
      setDeck(d);
      if (!d) {
        setLoadError("Este mazo ya no está disponible.");
        return;
      }
      if (d) {
        setName(d.name);
        const loadedCards = await listCardsByDeck(deckId);
        cardsRef.current = loadedCards;
        setCards(loadedCards);
        setLoadedDeckId(deckId);
        setAllTags(await listTags());
        setFolders(await listFolders());
        setProgress(await getDeckDailyProgress(deckId));
        setRecallScore(await getDeckRecallScore(deckId));
      }
      setLoadError("");
    } catch {
      setLoadError("No pudimos cargar este mazo.");
    }
  }, [deckId]);

  const refresh = useCallback(() => {
    allowNavigationRef.current = false;
    setEditMode(true);
    load();
  }, [load]);

  useFocusEffect(refresh);

  // Última elección del sheet de estudio (persistida en settings).
  useEffect(() => {
    if (Platform.OS === 'web') getSetting('desktopDeckColumns', 1).then((columns) => setTwoColumns(columns === 2));
    getSetting("studyPrefs", { starsOnly: false, ordered: false }).then((p) => {
      setStarsOnly(!!p.starsOnly);
      setOrdered(!!p.ordered);
    });
  }, []);

  const commitDraft = useCallback(() => {
    if (commitInFlightRef.current) return commitInFlightRef.current;
    const save = async () => {
    const editingId = activeIdRef.current;
    if (editingId == null) return true;
    const front = draftRef.current.front.trim();
    const back = draftRef.current.back.trim();
    if (editingId === "new") {
      if (!front && !back) {
        activeIdRef.current = null;
        setActiveId(null);
        return true;
      }
      if (!front || !back) { setEditError("Completá el frente y el dorso antes de guardar."); return false; }
      try {
        const newId = await createCard({ deckId, front, back });
        const created = await getCard(newId);
        const next = [...cardsRef.current, created];
        cardsRef.current = next;
        setCards(next);
        activeIdRef.current = null;
        setActiveId(null);
        setEditError("");
        return true;
      } catch { setEditError("No pudimos crear la tarjeta. Volvé a intentar."); return false; }
    }
    const original = cardsRef.current.find((c) => c.id === editingId);
    if (!original) return true;
    if (!front || !back) {
      setEditError("Completá el frente y el dorso antes de salir.");
      return false;
    }
    if (front === original.front && back === original.back) {
      setEditError("");
      return true;
    }
    try {
      await updateCardText(editingId, front, back, { markReviewed: true, expected: { front: original.front, back: original.back } });
      setCards((current) => {
        const next = current.map((card) =>
          card.id === editingId
            ? { ...card, front, back, source: card.source === "ai" ? "manual" : card.source }
            : card
        );
        cardsRef.current = next;
        return next;
      });
      setEditError("");
      return true;
    } catch (error) {
      setEditError(error.message || "No pudimos guardar esta tarjeta. Volvé a intentar.");
      return false;
    }
    };
    commitInFlightRef.current = save().finally(() => { commitInFlightRef.current = null; });
    return commitInFlightRef.current;
  }, [deckId]);

  useDesktopBeforeNavigate(commitDraft);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!editMode || activeId == null || allowNavigationRef.current) return;
      event.preventDefault();
      if (savingDraftRef.current) return;
      savingDraftRef.current = true;
      commitDraft()
        .then((saved) => {
          if (!saved) return;
          allowNavigationRef.current = true;
          navigation.dispatch(event.data.action);
        })
        .finally(() => {
          savingDraftRef.current = false;
        });
    });
    return unsubscribe;
  }, [activeId, commitDraft, editMode, navigation]);

  const toggleStar = useCallback(async (cardId) => {
    const item = cardsRef.current.find((card) => card.id === cardId);
    if (!item) return;
    const starred = item.starred ? 0 : 1;
    await setCardStarred(cardId, starred);
    setCards((current) => {
      const next = current.map((card) =>
        card.id === cardId ? { ...card, starred } : card
      );
      cardsRef.current = next;
      return next;
    });
  }, []);

  const toggleSuspended = useCallback(async (cardId) => {
    const item = cardsRef.current.find((card) => card.id === cardId);
    if (!item) return;
    const suspended = item.suspended ? 0 : 1;
    await setCardSuspended(cardId, suspended);
    setCards((current) => {
      const next = current.map((card) =>
        card.id === cardId ? { ...card, suspended } : card
      );
      cardsRef.current = next;
      return next;
    });
  }, []);

  const activateRow = useCallback(async (cardId) => {
    if (cardId === activeIdRef.current) return;
    const saved = await commitDraft();
    if (!saved) return;
    const card = cardsRef.current.find((candidate) => candidate.id === cardId);
    if (!card) return;
    const nextDraft = { front: card.front, back: card.back };
    activeIdRef.current = cardId;
    draftRef.current = nextDraft;
    setActiveId(cardId);
    setDraft(nextDraft);
  }, [commitDraft]);

  const changeDraft = useCallback((nextDraft) => {
    draftRef.current = nextDraft;
    setDraft(nextDraft);
  }, []);

  const addInlineCard = async () => {
    if (!await commitDraft()) return;
    setEditMode(true);
    setCardQuery(""); setCardFilter(null);
    const empty = { front: "", back: "" };
    activeIdRef.current = "new"; draftRef.current = empty;
    setActiveId("new"); setDraft(empty);
  };

  const openGym = async (cardId) => {
    if (await commitDraft()) router.push(`/gimnasio/nueva?cardId=${cardId}`);
  };

  const shareDeck = async () => {
    if (!await commitDraft()) return;
    try { await exportDeck(deckId); }
    catch (error) { setEditError(error.message || "No pudimos exportar el mazo."); }
  };

  const toggleDetails = () => {
    setShowDetails((value) => !value);
  };

  if (!deck || loadedDeckId !== deckId) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Mazo" }} />
        {!loadError && <EmptyState text="Cargando tarjetas…" icon="layers" full />}
        <Toast message={loadError} onRetry={load} />
      </Screen>
    );
  }

  const deckTagIds = deck.tags.map((t) => t.id);
  const starredCount = cards.filter((c) => c.starred).length;
  const visibleCards = filterDeckCards(cards, cardQuery, cardFilter);
  const filteringCards = !!cardQuery.trim() || cardFilter != null;
  const gridColumns = twoColumns && cardsWidth >= 740 ? 2 : 1;
  const cardGrid = (children) => Platform.OS === 'web'
    ? <View onLayout={(event) => setCardsWidth(event.nativeEvent.layout.width)}><div data-deck-columns={gridColumns} style={{ display: 'grid', gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`, gap: 20, alignItems: 'start' }}>{children}</div></View>
    : <View style={{ gap: spacing.sm }}>{children}</View>;
  const toggleColumns = async () => {
    const next = !twoColumns;
    setTwoColumns(next);
    try { await setSetting('desktopDeckColumns', next ? 2 : 1); }
    catch { setEditError('No pudimos recordar la vista elegida.'); }
  };

  const toggleTag = async (tagId) => {
    const next = deckTagIds.includes(tagId)
      ? deckTagIds.filter((t) => t !== tagId)
      : [...deckTagIds, tagId];
    await setDeckTags(deckId, next);
    load();
  };

  const addTag = async (tagName) => {
    const tagId = await ensureTag(tagName);
    if (!deckTagIds.includes(tagId)) await setDeckTags(deckId, [...deckTagIds, tagId]);
    load();
  };

  const saveName = async () => {
    if (name.trim()) await renameDeck(deckId, name);
    setEditingName(false);
    load();
  };

  const onDelete = () => setDeleteOpen(true);

  const exitEditMode = async () => {
    const saved = await commitDraft();
    if (!saved) return;
    activeIdRef.current = null;
    setActiveId(null);
    setEditMode(false);
    load();
  };

  const startStudy = async () => {
    if (!await commitDraft()) return;
    const stars = starsOnly && starredCount > 0;
    await setSetting("studyPrefs", { starsOnly: stars, ordered });
    setStudySheet(false);
    router.push(`/mazos/${deckId}/estudiar?stars=${stars ? 1 : 0}&ordered=${ordered ? 1 : 0}`);
  };

  const moveCard = async (cardId, offset) => {
    const next = [...cardsRef.current];
    const from = next.findIndex((card) => card.id === cardId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    try { await setCardPositions(deckId, next.map((card) => card.id)); cardsRef.current = next; setCards(next); }
    catch { setEditError("No pudimos guardar el orden."); }
  };

  const cardRow = (item) => (
    <Card
      level="high"
      style={styles.card}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Editar tarjeta" onPress={() => router.push(`/mazos/${deckId}/tarjeta?cardId=${item.id}`)} style={{ flex: 1, gap: 4 }}>
        <Text style={styles.cardFront} numberOfLines={2}>
          {toPlainText(item.front)}
        </Text>
        <View style={styles.cardPills}>
          {item.source === "hybrid" ? (
            <Pill icon="zap" label="Idea" color={textColors.violeta} style={styles.ideaPill} />
          ) : null}
          {item.source === "ai" ? (
            <Pill icon="cpu" label="Sin revisar" color={colors.accentText} />
          ) : null}
          {item.suspended ? (
            <Pill icon="pause-circle" label="Suspendida" color={colors.textMuted} />
          ) : null}
        </View>
        <Text style={[type.small, Platform.OS === 'web' && { fontSize: 16, lineHeight: 24 }]} numberOfLines={2}>
          {toPlainText(item.back)}
        </Text>
      </Pressable>
      {/* Las tres acciones apiladas a la derecha. El "Pensar esto con el socio"
          era un texto que se comía una línea entera de la fila: ahora es el
          ícono solo, alineado con la suspensión y la estrella. */}
      <View style={styles.cardActions}>
        {Platform.OS === "web" && !filteringCards && <View style={{ flexDirection: "row" }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Subir tarjeta" disabled={cards[0]?.id === item.id} onPress={() => moveCard(item.id, -1)} style={styles.cardAction}><Feather name="arrow-up" size={18} color={colors.textMuted} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Bajar tarjeta" disabled={cards[cards.length - 1]?.id === item.id} onPress={() => moveCard(item.id, 1)} style={styles.cardAction}><Feather name="arrow-down" size={18} color={colors.textMuted} /></Pressable>
        </View>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Conversar sobre esta tarjeta"
          onPress={() => router.push(`/gimnasio/nueva?cardId=${item.id}`)}
          hitSlop={2}
          style={({ pressed }) => [styles.cardAction, pressed && { opacity: 0.65 }]}
        >
          <Feather name="message-circle" size={18} color={colors.accentText} />
        </Pressable>
        <SuspendToggle
          suspended={!!item.suspended}
          onPress={() => toggleSuspended(item.id)}
        />
        <StarToggle starred={!!item.starred} onPress={() => toggleStar(item.id)} />
      </View>
    </Card>
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerShown: Platform.OS !== 'web',
          title: deck.name,
          headerTitle: () => <Pressable accessibilityRole="button" accessibilityLabel="Renombrar mazo" onPress={() => setEditingName(true)}><Text style={type.label}>{deck.name}</Text></Pressable>,
          headerRight: () =>
            !editMode ? (
              <Pressable onPress={() => setEditMode(true)} hitSlop={10}>
                <Text style={styles.doneLabel}>Listo</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
                <Feather name="more-horizontal" size={22} color={colors.text} />
              </Pressable>
            ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        {Platform.OS === "web" && <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 20 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Renombrar mazo" style={{ flex: 1 }} onPress={() => setEditingName(true)}><Text style={[type.heading, { fontSize: 28 }]}>{deck.name}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={twoColumns ? 'Mostrar tarjetas en lista' : 'Mostrar tarjetas en dos columnas'} accessibilityState={{ selected: twoColumns }} onPress={toggleColumns} style={({ hovered }) => ({ width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered || twoColumns ? colors.surfaceHigh : 'transparent' })}>
            <Feather name={twoColumns ? 'list' : 'columns'} size={21} color={twoColumns ? colors.accentText : colors.textMuted} />
          </Pressable>
          <Button label={editMode ? 'Reordenar tarjetas' : 'Volver a editar'} onPress={editMode ? exitEditMode : () => {
            allowNavigationRef.current = false; setEditError(''); setEditMode(true); activeIdRef.current = null; setActiveId(null);
          }} />
          <Button label="Estudiar" kind="primary" onPress={() => setStudySheet(true)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Opciones del mazo" onPress={() => setMenuOpen(true)} style={{ padding: 10 }}><Feather name="more-horizontal" size={20} color={colors.textMuted} /></Pressable>
        </View>}
        <View style={{ gap: spacing.md }}>
          <Stagger>
          {editingName ? (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Field value={name} onChangeText={setName} style={{ flex: 1 }} autoFocus />
              <Button label="Guardar" kind="primary" onPress={saveName} />
            </View>
          ) : Platform.OS !== "web" ? (
            <HeroButton
              label="ESTUDIAR AHORA"
              onPress={() => setStudySheet(true)}
              style={{ marginTop: 22, marginBottom: 20 }}
            />
          ) : null}

          {activeId != null && activeId !== "new" && <Button label="Guardar cambios" onPress={async () => {
            if (await commitDraft()) { activeIdRef.current = null; setActiveId(null); }
          }} />}

          {progress && progress.total > 0 ? (
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.progressHead}>
                <Text style={type.label}>Progreso de hoy</Text>
                {recallScore != null ? (
                  <Pill label={`Recuerdo ${recallScore}%`} color={colors.successBright} labelStyle={Platform.OS === 'web' ? { fontSize: 14 } : undefined} style={Platform.OS === 'web' ? { paddingHorizontal: 14, paddingVertical: 8 } : undefined} />
                ) : null}
              </View>
              <Text style={type.small}>
                {progress.reviewedToday}/{progress.total} tarjetas repasadas
              </Text>
              <ProgressBar pct={progress.pct} gradient={gradients.progress} glowStyle={glow.green} style={Platform.OS === 'web' ? { height: 14, marginTop: 4 } : undefined} />
            </Card>
          ) : null}

          <Collapsible icon="sliders" title="Editar detalles" open={showDetails} onToggle={toggleDetails}>
              <View style={{ gap: spacing.sm }}>
                <Text style={type.label}>Etiquetas</Text>
                <View style={styles.tagRow}>
                  {allTags.map((t) => (
                    <Chip
                      key={t.id}
                      label={t.name}
                      active={deckTagIds.includes(t.id)}
                      onPress={() => toggleTag(t.id)}
                    />
                  ))}
                </View>
                <InlineAdd placeholder="Etiqueta nueva…" onSubmit={addTag} />
              </View>

              {folders.length > 0 ? (
                <View style={{ gap: spacing.sm }}>
                  <Text style={type.label}>Carpeta</Text>
                  <View style={styles.tagRow}>
                    {folders.map((f) => (
                      <Chip
                        key={f.id}
                        label={folderPath(folders, f.id).map((part) => part.name).join(" / ")}
                        active={deck.folder_id === f.id}
                        onPress={async () => {
                          await setDeckFolder(deckId, deck.folder_id === f.id ? null : f.id);
                          load();
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={{ gap: spacing.sm }}>
                <Text style={type.label}>Prioridad en el repaso diario</Text>
                <PercentSlider
                  value={deck.priority}
                  onChange={async (p) => {
                    await updateDeckPriority(deckId, p);
                    load();
                  }}
                />
              </View>

              <View style={{ gap: spacing.sm }}>
                <Pressable
                  onPress={() => setShowIconPicker((s) => !s)}
                  style={({ pressed }) => [styles.iconRow, pressed && { opacity: 0.7 }]}
                >
                  <Feather name={deck.icon || "book"} size={20} color={colors.accentText} />
                  <Text style={type.small}>
                    {showIconPicker ? "Elegí un ícono para el mazo" : "Cambiar ícono"}
                  </Text>
                </Pressable>
                {showIconPicker ? (
                  <IconPicker
                    value={deck.icon || "book"}
                    onChange={async (icon) => {
                      await updateDeckIcon(deckId, icon);
                      setShowIconPicker(false);
                      load();
                    }}
                  />
                ) : null}
              </View>
          </Collapsible>

          {cards.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <View style={styles.cardSearch}>
                <Feather name="search" size={17} color={colors.textMuted} />
                <Field
                  value={cardQuery}
                  onChangeText={setCardQuery}
                  placeholder="Buscar dentro del mazo…"
                  style={styles.cardSearchField}
                  onFocus={() => setCardSearchFocused(true)}
                  // El delay es obligatorio: sin él el blur se traga el tap
                  // sobre el chip y el filtro nunca se aplica.
                  onBlur={() => setTimeout(() => setCardSearchFocused(false), 120)}
                />
                {cardQuery ? (
                  <Pressable onPress={() => setCardQuery("")} hitSlop={8}>
                    <Feather name="x" size={17} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              {/* Con un filtro puesto siguen a la vista aunque el buscador
                  pierda el foco: si no, no habría cómo sacarlo. */}
              {cardSearchFocused || cardFilter != null ? (
                <View style={styles.tagRow}>
                  <Chip
                    label="Todas"
                    active={cardFilter == null}
                    onPress={() => setCardFilter(null)}
                  />
                  <Chip
                    label="⭐"
                    active={cardFilter === "starred"}
                    onPress={() => setCardFilter(cardFilter === "starred" ? null : "starred")}
                  />
                  <Chip
                    label="⚡ Ideas"
                    active={cardFilter === "idea"}
                    onPress={() => setCardFilter(cardFilter === "idea" ? null : "idea")}
                  />
                  <Chip
                    label="🤖 Sin revisar"
                    active={cardFilter === "unreviewed"}
                    onPress={() =>
                      setCardFilter(cardFilter === "unreviewed" ? null : "unreviewed")
                    }
                  />
                  <Chip
                    label="Suspendidas"
                    active={cardFilter === "suspended"}
                    onPress={() =>
                      setCardFilter(cardFilter === "suspended" ? null : "suspended")
                    }
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {cards.length === 0 ? (
            <EmptyState text="Este mazo no tiene tarjetas todavía." />
          ) : visibleCards.length === 0 ? (
            <EmptyState text="No hay tarjetas que coincidan con este filtro." icon="search" />
          ) : editMode ? (
            // En modo edición la lista va plana: el drag & drop y los editores
            // no pueden convivir (uno necesita long-press, el otro el foco).
            cardGrid(visibleCards.map((item, i) => (
                <EditableCardRow
                  key={item.id}
                  card={item}
                  index={i}
                  total={visibleCards.length}
                  active={activeId === item.id}
                  draft={activeId === item.id ? draft : null}
                  onActivate={activateRow}
                  onChangeDraft={changeDraft}
                  onToggleStar={toggleStar}
                  onToggleSuspended={toggleSuspended}
                  onGym={openGym}
                />
              )))
          ) : Platform.OS === "web" || filteringCards ? (
            // El drag & drop es para el teléfono y solo sobre la lista completa:
            // reordenar un subconjunto filtrado generaría posiciones ambiguas.
            cardGrid(visibleCards.map((item) => <View key={item.id}>{cardRow(item)}</View>))
          ) : (
            <Sortable.Grid
              columns={1}
              data={visibleCards}
              keyExtractor={(c) => String(c.id)}
              rowGap={spacing.sm}
              onDragEnd={async ({ data }) => {
                setCards(data);
                await setCardPositions(deckId, data.map((c) => c.id));
              }}
              renderItem={({ item }) => cardRow(item)}
            />
          )}

          {activeId === "new" && <View style={{ gap: spacing.sm }}>
            <EditableCardRow card={{ id: "new", source: "manual" }} index={cards.length} total={cards.length + 1} active draft={draft} onChangeDraft={changeDraft} />
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button label="Guardar tarjeta" kind="primary" onPress={commitDraft} />
              <Button label="Cancelar" onPress={async () => {
                if ((draftRef.current.front || draftRef.current.back) && !await confirmAsync("Descartar tarjeta", "Se perderá el contenido de esta tarjeta nueva.")) return;
                activeIdRef.current = null; setActiveId(null); setEditError("");
              }} />
            </View>
          </View>}
          <Pressable
            accessibilityRole="button" accessibilityLabel="Nueva tarjeta"
            onPress={addInlineCard}
            style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.7 }]}
          >
            <Feather name="plus" size={22} color={colors.accentText} />
          </Pressable>
          </Stagger>
        </View>
      </ScrollView>

      <ConfirmDeleteSheet visible={deleteOpen} name={deck.name} description={`Se borrará el mazo con sus ${cards.length} tarjetas. No se puede deshacer.`} onClose={() => setDeleteOpen(false)} onConfirm={async () => {
        await deleteDeck(deckId); allowNavigationRef.current = true; activeIdRef.current = null; setActiveId(null);
        if (router.canGoBack()) router.back(); else router.replace("/biblioteca");
      }} />
      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={deck.name}
        options={[
          {
            icon: "edit-3",
            label: editMode ? "Reordenar tarjetas" : "Volver a editar",
            onPress: async () => {
              if (editMode) { await exitEditMode(); return; }
              allowNavigationRef.current = false;
              setEditError("");
              setEditMode(true);
              activeIdRef.current = null;
              setActiveId(null);
            },
          },
          { icon: "share-2", label: "Compartir / Exportar", onPress: shareDeck },
          {
            icon: "sliders",
            label: showDetails ? "Ocultar detalles" : "Editar detalles",
            onPress: toggleDetails,
          },
          ...(cards.length > 0
            ? [
                {
                  icon: "message-circle",
                  label: "Pensar una tarjeta",
                  onPress: () => router.push(`/gimnasio/nueva?deckId=${deckId}`),
                },
              ]
            : []),
          { icon: "trash-2", label: "Borrar mazo", destructive: true, onPress: onDelete },
        ]}
      />

      <ActionSheet
        visible={studySheet}
        onClose={() => setStudySheet(false)}
        title="¿Cómo estudiamos?"
      >
        <Text style={type.label}>Tarjetas</Text>
        <View style={styles.tagRow}>
          <Chip label="Todas" active={!starsOnly} onPress={() => setStarsOnly(false)} />
          <View style={{ opacity: starredCount === 0 ? 0.4 : 1 }}>
            <Chip
              label={`Solo ⭐ (${starredCount})`}
              active={starsOnly && starredCount > 0}
              onPress={() => starredCount > 0 && setStarsOnly(true)}
            />
          </View>
        </View>
        <Text style={[type.label, { marginTop: spacing.sm }]}>Orden</Text>
        <View style={styles.tagRow}>
          <Chip label="Barajado" active={!ordered} onPress={() => setOrdered(false)} />
          <Chip label="Mi orden" active={ordered} onPress={() => setOrdered(true)} />
        </View>
        <HeroButton label="Empezar" onPress={startStudy} style={{ marginTop: spacing.md }} />
      </ActionSheet>

      <Toast
        message={editError || loadError}
        onRetry={!editError && loadError ? load : undefined}
        onDismiss={() => {
          setEditError("");
          setLoadError("");
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  cardAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  progressHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  doneLabel: {
    ...type.body,
    fontSize: 16,
    ...font(700),
    color: colors.accentText,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...(Platform.OS === 'web' ? { minHeight: 120, padding: 20, gap: 16 } : {}),
  },
  cardFront: {
    ...type.body,
    ...font(500),
    ...(Platform.OS === 'web' ? { fontSize: 18, lineHeight: 27 } : {}),
  },
  cardPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  cardSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.pillBorder,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
  },
  cardSearchField: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  cardActions: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  ideaPill: {
    borderColor: "rgba(158,110,222,0.35)",
    backgroundColor: "rgba(158,110,222,0.10)",
  },
  // El contenedor externo lleva el halo y NO recorta; el degradé interno se
  // redondea solo (si el externo tuviera overflow hidden, se comería el halo).
  heroBtnOuter: {
    borderRadius: radius.pill,
  },
  heroBtn: {
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  heroBtnLabel: {
    color: "#FFFFFF",
    ...font(700),
    fontSize: 16,
    letterSpacing: 1,
  },
  addRow: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(143,166,243,0.35)",
    borderRadius: radius.md,
    alignItems: "center",
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
});
