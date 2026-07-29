import { Feather, FontAwesome } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Sortable from "react-native-sortables";

import ActionSheet from "../../../components/ActionSheet";
import EditableCardRow from "../../../components/EditableCardRow";
import GlowPressable from "../../../components/GlowPressable";
import IconPicker from "../../../components/IconPicker";
import PercentSlider from "../../../components/PercentSlider";
import ProgressBar from "../../../components/ProgressBar";
import Stagger from "../../../components/Stagger";
import Toast from "../../../components/Toast";
import { Button, Card, Chip, confirmAsync, EmptyState, Field, InlineAdd, Pill, Screen } from "../../../components/ui";
import { listCardsByDeck, setCardPositions, setCardStarred, updateCardText } from "../../../db/cards";
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
import { getDeckRetention } from "../../../db/stats";
import { getSetting, setSetting } from "../../../db/settings";
import { toPlainText } from "../../../lib/richtext";
import { colors, font, glow, gradients, radius, spacing, textColors, type } from "../../../theme";

// Botón destacado con la visual del hero de Inicio (degradado azul).
// Se usa arriba del mazo y como "Empezar" del sheet de estudio. El halo cobalto
// aparece SOLO al tocarlo (o con el mouse encima en la web).
export function HeroButton({ label, onPress, style }) {
  return (
    <GlowPressable onPress={onPress} style={[styles.heroBtnOuter, style]}>
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
    <Pressable onPress={onPress} hitSlop={10}>
      {starred ? (
        <FontAwesome name="star" size={size} color="#FFC53D" />
      ) : (
        <Feather name="star" size={size} color={colors.textMuted} style={{ opacity: 0.4 }} />
      )}
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
  const [showDetails, setShowDetails] = useState(false);
  const [studySheet, setStudySheet] = useState(false);
  const [starsOnly, setStarsOnly] = useState(false);
  const [ordered, setOrdered] = useState(false);
  const [retention, setRetention] = useState(null);
  // Modo edición: todas las tarjetas abiertas, se editan sin entrar a cada una.
  // activeId es la única que monta editores de verdad (ver EditableCardRow).
  const [editMode, setEditMode] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState({ front: "", back: "" });
  const [editError, setEditError] = useState("");
  const allowNavigationRef = useRef(false);
  const savingDraftRef = useRef(false);

  const load = useCallback(async () => {
    const d = await getDeck(deckId);
    setDeck(d);
    if (d) {
      setName(d.name);
      setCards(await listCardsByDeck(deckId));
      setAllTags(await listTags());
      setFolders(await listFolders());
      setProgress(await getDeckDailyProgress(deckId));
      setRetention(await getDeckRetention(deckId));
    }
  }, [deckId]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  useFocusEffect(refresh);

  // Última elección del sheet de estudio (persistida en settings).
  useEffect(() => {
    getSetting("studyPrefs", { starsOnly: false, ordered: false }).then((p) => {
      setStarsOnly(!!p.starsOnly);
      setOrdered(!!p.ordered);
    });
  }, []);

  const commitDraft = useCallback(async () => {
    if (activeId == null) return true;
    const original = cards.find((c) => c.id === activeId);
    if (!original) return true;
    const front = draft.front.trim();
    const back = draft.back.trim();
    if (!front || !back) {
      setEditError("Completá el frente y el dorso antes de salir.");
      return false;
    }
    if (front === original.front && back === original.back) {
      setEditError("");
      return true;
    }
    try {
      await updateCardText(activeId, front, back);
      setCards((cs) => cs.map((c) => (c.id === activeId ? { ...c, front, back } : c)));
      setEditError("");
      return true;
    } catch {
      setEditError("No pudimos guardar esta tarjeta. Volvé a intentar.");
      return false;
    }
  }, [activeId, cards, draft]);

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

  if (!deck) return <Screen />;

  const deckTagIds = deck.tags.map((t) => t.id);
  const starredCount = cards.filter((c) => c.starred).length;

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

  const onDelete = async () => {
    const ok = await confirmAsync(
      "Borrar mazo",
      `Se borra "${deck.name}" con sus ${cards.length} tarjetas. No se puede deshacer.`
    );
    if (ok) {
      await deleteDeck(deckId);
      router.back();
    }
  };

  const toggleStar = async (item) => {
    await setCardStarred(item.id, item.starred ? 0 : 1);
    setCards((cs) => cs.map((c) => (c.id === item.id ? { ...c, starred: item.starred ? 0 : 1 } : c)));
  };

  const activateRow = async (card) => {
    if (card.id === activeId) return;
    const saved = await commitDraft();
    if (!saved) return;
    setActiveId(card.id);
    setDraft({ front: card.front, back: card.back });
  };

  const exitEditMode = async () => {
    const saved = await commitDraft();
    if (!saved) return;
    setActiveId(null);
    setEditMode(false);
    load();
  };

  const startStudy = async () => {
    const stars = starsOnly && starredCount > 0;
    await setSetting("studyPrefs", { starsOnly: stars, ordered });
    setStudySheet(false);
    router.push(`/mazos/${deckId}/estudiar?stars=${stars ? 1 : 0}&ordered=${ordered ? 1 : 0}`);
  };

  const cardRow = (item) => (
    <Card
      level="high"
      onPress={() => router.push(`/mazos/${deckId}/tarjeta?cardId=${item.id}`)}
      style={styles.card}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.cardFront} numberOfLines={2}>
          {toPlainText(item.front)}
        </Text>
        {item.source === "hybrid" ? (
          <Pill icon="zap" label="Idea" color={textColors.violeta} style={styles.ideaPill} />
        ) : null}
        <Text style={type.small} numberOfLines={1}>
          {toPlainText(item.back)}
        </Text>
      </View>
      <StarToggle starred={!!item.starred} onPress={() => toggleStar(item)} />
    </Card>
  );

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: editMode ? `Editando · ${deck.name}` : deck.name,
          headerRight: () =>
            editMode ? (
              <Pressable onPress={exitEditMode} hitSlop={10}>
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
        <View style={{ gap: spacing.md }}>
          <Stagger>
          {editingName ? (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Field value={name} onChangeText={setName} style={{ flex: 1 }} autoFocus />
              <Button label="Guardar" kind="primary" onPress={saveName} />
            </View>
          ) : (
            <HeroButton
              label="ESTUDIAR AHORA"
              onPress={() => setStudySheet(true)}
              style={{ marginTop: 22, marginBottom: 20 }}
            />
          )}

          {progress && progress.total > 0 ? (
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.progressHead}>
                <Text style={type.label}>Progreso de hoy</Text>
                {retention != null ? (
                  <Pill label={`Retención ${retention}%`} color={colors.successBright} />
                ) : null}
              </View>
              <Text style={type.small}>
                {progress.reviewedToday}/{progress.total} tarjetas repasadas
              </Text>
              <ProgressBar pct={progress.pct} gradient={gradients.progress} glowStyle={glow.green} />
            </Card>
          ) : null}

          {showDetails ? (
            <Card style={{ gap: spacing.md }}>
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
                        label={f.name}
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
            </Card>
          ) : null}

          {cards.length === 0 ? (
            <EmptyState text="Este mazo no tiene tarjetas todavía." />
          ) : editMode ? (
            // En modo edición la lista va plana: el drag & drop y los editores
            // no pueden convivir (uno necesita long-press, el otro el foco).
            <View style={{ gap: spacing.sm }}>
              {cards.map((item, i) => (
                <EditableCardRow
                  key={item.id}
                  card={item}
                  index={i}
                  total={cards.length}
                  active={activeId === item.id}
                  draft={draft}
                  onActivate={() => activateRow(item)}
                  onChangeDraft={setDraft}
                  onToggleStar={() => toggleStar(item)}
                />
              ))}
            </View>
          ) : Platform.OS === "web" ? (
            // El drag & drop es para el teléfono; en web la lista es estática.
            <View style={{ gap: spacing.sm }}>{cards.map((item) => <View key={item.id}>{cardRow(item)}</View>)}</View>
          ) : (
            <Sortable.Grid
              columns={1}
              data={cards}
              keyExtractor={(c) => String(c.id)}
              rowGap={spacing.sm}
              onDragEnd={async ({ data }) => {
                setCards(data);
                await setCardPositions(deckId, data.map((c) => c.id));
              }}
              renderItem={({ item }) => cardRow(item)}
            />
          )}

          <Pressable
            onPress={() => router.push(`/mazos/${deckId}/tarjeta`)}
            style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.7 }]}
          >
            <Feather name="plus" size={22} color={colors.accentText} />
          </Pressable>
          </Stagger>
        </View>
      </ScrollView>

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={deck.name}
        options={[
          {
            icon: "edit-3",
            label: "Editar tarjetas",
            onPress: () => {
              allowNavigationRef.current = false;
              setEditError("");
              setEditMode(true);
              setActiveId(null);
            },
          },
          { icon: "edit-2", label: "Renombrar", onPress: () => setEditingName(true) },
          {
            icon: "sliders",
            label: showDetails ? "Ocultar detalles" : "Editar detalles",
            onPress: () => setShowDetails((s) => !s),
          },
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

      <Toast message={editError} onDismiss={() => setEditError("")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  },
  cardFront: {
    ...type.body,
    ...font(500),
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
