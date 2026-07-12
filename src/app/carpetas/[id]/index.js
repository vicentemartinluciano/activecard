// Pantalla de carpeta: sus mazos, agregar/quitar mazos sueltos,
// renombrar y borrar (los mazos nunca se borran: quedan sueltos).

import { Feather } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import DeckListItem from "../../../components/DeckListItem";
import { Button, Card, confirmAsync, EmptyState, Field, Screen } from "../../../components/ui";
import { listDecks, setDeckFolder } from "../../../db/decks";
import { deleteFolder, getFolder, renameFolder } from "../../../db/folders";
import { getDecksDailyProgress } from "../../../db/progress";
import { colors, spacing, type } from "../../../theme";

export default function DetalleCarpeta() {
  const { id } = useLocalSearchParams();
  const folderId = Number(id);
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/biblioteca"));

  const [folder, setFolder] = useState(null);
  const [decks, setDecks] = useState([]);
  const [progressByDeck, setProgressByDeck] = useState({});
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const f = await getFolder(folderId);
    if (!f) {
      // La carpeta ya no existe (p. ej. recién borrada): volver a la Biblioteca.
      if (router.canGoBack()) router.back();
      else router.replace("/biblioteca");
      return;
    }
    setFolder(f);
    setName(f.name);
    const [d, p] = await Promise.all([listDecks(), getDecksDailyProgress()]);
    setDecks(d);
    setProgressByDeck(p);
  }, [folderId, router]);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  useFocusEffect(refresh);

  if (!folder) return <Screen />;

  const folderDecks = decks.filter((d) => d.folder_id === folderId);
  const looseDecks = decks.filter((d) => !d.folder_id);

  const saveName = async () => {
    if (name.trim()) await renameFolder(folderId, name);
    setEditingName(false);
    load();
  };

  const addDeck = async (deckId) => {
    await setDeckFolder(deckId, folderId);
    load();
  };

  const removeDeck = async (deckId) => {
    await setDeckFolder(deckId, null);
    load();
  };

  const onDelete = async () => {
    const ok = await confirmAsync(
      "Borrar carpeta",
      `Se borra "${folder.name}". Los mazos no se borran: quedan sueltos en la Biblioteca.`
    );
    if (ok) {
      await deleteFolder(folderId);
      goBack();
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: folder.name }} />
      <FlatList
        data={folderDecks}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            {editingName ? (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Field value={name} onChangeText={setName} style={{ flex: 1 }} autoFocus />
                <Button label="Guardar" kind="primary" onPress={saveName} />
              </View>
            ) : (
              <View style={styles.headerRow}>
                <Feather name="folder" size={22} color={colors.accentText} />
                <Text style={styles.folderTitle} numberOfLines={1}>
                  {folder.name}
                </Text>
                <Button label="Renombrar" onPress={() => setEditingName(true)} />
              </View>
            )}
            <Text style={type.label}>
              {folderDecks.length} {folderDecks.length === 1 ? "mazo" : "mazos"} en esta carpeta
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState text="Esta carpeta está vacía. Agregá mazos desde abajo." />
        }
        renderItem={({ item }) => (
          <View style={styles.deckRow}>
            <View style={{ flex: 1 }}>
              <DeckListItem
                deck={item}
                progress={progressByDeck[item.id]}
                onPress={() => router.push(`/mazos/${item.id}`)}
              />
            </View>
            <Pressable
              onPress={() => removeDeck(item.id)}
              hitSlop={8}
              style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="x" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
            <Button
              label={showAdd ? "Ocultar mazos sueltos" : "Agregar mazos"}
              onPress={() => setShowAdd((s) => !s)}
            />
            {showAdd ? (
              looseDecks.length === 0 ? (
                <EmptyState text="No hay mazos sueltos para agregar." />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {looseDecks.map((d) => (
                    <Card key={d.id} level="high" onPress={() => addDeck(d.id)} style={styles.addRow}>
                      <Feather name="plus" size={18} color={colors.accentText} />
                      <Text style={type.body} numberOfLines={1}>
                        {d.name}
                      </Text>
                    </Card>
                  ))}
                </View>
              )
            ) : null}
            <Button label="Borrar carpeta" kind="danger" onPress={onDelete} />
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  folderTitle: {
    ...type.heading,
    flex: 1,
  },
  deckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  removeBtn: {
    padding: spacing.xs,
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
