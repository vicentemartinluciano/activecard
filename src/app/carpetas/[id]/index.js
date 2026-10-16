// Pantalla de carpeta: sus mazos, agregar/quitar mazos sueltos,
// renombrar y borrar (los mazos nunca se borran: quedan sueltos).

import Feather from "@expo/vector-icons/Feather";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import DeckListItem from "../../../components/DeckListItem";
import ActionSheet from "../../../components/ActionSheet";
import ConfirmDeleteSheet from "../../../components/ConfirmDeleteSheet";
import { Button, Card, EmptyState, Field, Screen } from "../../../components/ui";
import { listDecks, setDeckFolder } from "../../../db/decks";
import { deleteFolder, getFolder, listFolders, moveFolder, renameFolder } from "../../../db/folders";
import { canMoveFolder, folderPath } from "../../../lib/folderTree";
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
  const [folders, setFolders] = useState([]);
  const [showMove, setShowMove] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const load = useCallback(async () => {
    const f = await getFolder(folderId);
    if (!f) {
      // La carpeta ya no existe (p. ej. recién borrada): volver a la Biblioteca.
      if (router.canGoBack()) router.back();
      else router.replace("/biblioteca");
      return;
    }
    setFolder(f);
    setFolders(await listFolders());
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
  const children = folders.filter((f) => f.parent_id === folderId);
  const move = async (parentId) => {
    try { await moveFolder(folderId, parentId); setShowMove(false); setError(""); await load(); }
    catch (e) { setError(e.message); }
  };

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

  const onDelete = () => setDeleteOpen(true);

  return (
    <Screen>
      <Stack.Screen options={{ title: folder.name }} />
      <FlatList
        data={folderDecks}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Button label="Biblioteca" kind="ghost" onPress={() => router.push("/biblioteca")} />
              {folderPath(folders, folder.parent_id).map((parent) => <Button key={parent.id} label={parent.name} kind="ghost" onPress={() => router.push(`/carpetas/${parent.id}`)} />)}
            </View>
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
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              <Button label="Crear subcarpeta" onPress={() => router.push(`/crear?parentId=${folderId}`)} />
              <Button label="Mover carpeta" onPress={() => setShowMove(true)} />
            </View>
            {children.map((child) => <Card key={child.id} onPress={() => router.push(`/carpetas/${child.id}`)} style={styles.addRow}>
              <Feather name="folder" size={20} color={colors.accentText} /><Text style={type.body}>{child.name}</Text>
            </Card>)}
            {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          children.length ? null : <EmptyState text="Esta carpeta está vacía. Agregá mazos desde abajo." />
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
      <ConfirmDeleteSheet visible={deleteOpen} name={folder.name} description="Los mazos quedan sueltos y las subcarpetas suben al nivel anterior." onClose={() => setDeleteOpen(false)} onConfirm={async () => { await deleteFolder(folderId); goBack(); }} />
      <ActionSheet visible={showMove} title="Mover carpeta a…" onClose={() => setShowMove(false)}>
        <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
          <Button label="Biblioteca (raíz)" onPress={() => move(null)} />
          {folders.filter((f) => canMoveFolder(folders, folderId, f.id)).map((f) => <Button key={f.id} label={folderPath(folders, f.id).map((part) => part.name).join(" / ")} onPress={() => move(f.id)} />)}
          {!!error && <Text style={{ color: colors.danger }}>{error}</Text>}
        </ScrollView>
      </ActionSheet>
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
