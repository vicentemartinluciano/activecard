import { Feather } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import ActionSheet from "../../../components/ActionSheet";
import IconPicker from "../../../components/IconPicker";
import PercentSlider from "../../../components/PercentSlider";
import ProgressBar from "../../../components/ProgressBar";
import { Button, Card, Chip, confirmAsync, EmptyState, Field, InlineAdd, Screen } from "../../../components/ui";
import { listCardsByDeck } from "../../../db/cards";
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
import { toPlainText } from "../../../lib/richtext";
import { colors, radius, spacing, type } from "../../../theme";

export default function DetalleMazo() {
  const { id } = useLocalSearchParams();
  const deckId = Number(id);
  const router = useRouter();

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

  const load = useCallback(async () => {
    const d = await getDeck(deckId);
    setDeck(d);
    if (d) {
      setName(d.name);
      setCards(await listCardsByDeck(deckId));
      setAllTags(await listTags());
      setFolders(await listFolders());
      setProgress(await getDeckDailyProgress(deckId));
    }
  }, [deckId]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  useFocusEffect(refresh);

  if (!deck) return <Screen />;

  const deckTagIds = deck.tags.map((t) => t.id);

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

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: deck.name,
          headerRight: () => (
            <Pressable onPress={() => setMenuOpen(true)} hitSlop={10}>
              <Feather name="more-horizontal" size={22} color={colors.text} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={cards}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            {editingName ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Field value={name} onChangeText={setName} style={{ flex: 1 }} autoFocus />
                <Button label="Guardar" kind="primary" onPress={saveName} />
              </View>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Button
                  label="ESTUDIAR AHORA"
                  kind="primary"
                  size="lg"
                  onPress={() => router.push(`/mazos/${deckId}/estudiar`)}
                />
                <Button
                  label="+ NUEVA TARJETA"
                  size="lg"
                  onPress={() => router.push(`/mazos/${deckId}/tarjeta`)}
                />
              </View>
            )}

            {progress && progress.total > 0 ? (
              <Card style={{ gap: spacing.sm }}>
                <Text style={type.label}>Progreso de hoy</Text>
                <Text style={type.small}>
                  {progress.reviewedToday}/{progress.total} tarjetas repasadas
                </Text>
                <ProgressBar pct={progress.pct} color={colors.successBright} />
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
          </View>
        }
        ListEmptyComponent={<EmptyState text="Este mazo no tiene tarjetas todavía." />}
        renderItem={({ item }) => (
          <Card
            level="high"
            onPress={() => router.push(`/mazos/${deckId}/tarjeta?cardId=${item.id}`)}
            style={styles.card}
          >
            <Text style={styles.cardFront} numberOfLines={2}>
              {toPlainText(item.front)}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {item.source === "hybrid" ? "★ conexión · " : ""}
              {toPlainText(item.back)}
            </Text>
          </Card>
        )}
      />

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={deck.name}
        options={[
          { icon: "edit-2", label: "Renombrar", onPress: () => setEditingName(true) },
          {
            icon: "sliders",
            label: showDetails ? "Ocultar detalles" : "Editar detalles",
            onPress: () => setShowDetails((s) => !s),
          },
          { icon: "trash-2", label: "Borrar mazo", destructive: true, onPress: onDelete },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  card: {
    borderRadius: radius.md,
    gap: 4,
  },
  cardFront: {
    ...type.body,
    fontWeight: "500",
  },
});
