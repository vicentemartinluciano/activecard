// Gimnasio Mental: vista derivada de las tarjetas-idea (cards source='hybrid').
// Espejo de la Biblioteca — carpetas con ideas arriba + TODOS los mazos con
// ideas abajo (sueltos primero). La idea vive UNA sola vez, en su mazo; acá
// solo se la muestra desde otro ángulo. Con ?folderId=N filtra a esa carpeta.

import { Feather } from "@expo/vector-icons";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { Card, EmptyState, Pill, Screen } from "../../components/ui";
import { listDecksWithIdeas } from "../../db/cards";
import { listFolders } from "../../db/folders";
import { colors, glow, spacing, textColors, type } from "../../theme";

export default function GimnasioMental() {
  const router = useRouter();
  const { folderId } = useLocalSearchParams();
  const folderFilter = folderId != null ? Number(folderId) : null;
  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([listDecksWithIdeas(), listFolders()]).then(([d, f]) => {
        if (!alive) return;
        setDecks(d);
        setFolders(f);
      });
      return () => {
        alive = false;
      };
    }, [])
  );

  // Carpetas que contienen al menos un mazo con ideas.
  const ideaFolderIds = new Set(decks.filter((d) => d.folder_id).map((d) => d.folder_id));
  const ideaFolders = folders.filter((f) => ideaFolderIds.has(f.id));
  const deckCountByFolder = {};
  for (const d of decks) {
    if (d.folder_id) deckCountByFolder[d.folder_id] = (deckCountByFolder[d.folder_id] || 0) + 1;
  }

  const visibleDecks =
    folderFilter != null ? decks.filter((d) => d.folder_id === folderFilter) : decks;
  const activeFolder = folderFilter != null ? folders.find((f) => f.id === folderFilter) : null;
  const showFolderGrid = folderFilter == null && ideaFolders.length > 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: activeFolder ? activeFolder.name : "Gimnasio Mental" }} />
      <FlatList
        data={visibleDecks}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          showFolderGrid ? (
            <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
              <Text style={type.label}>Carpetas</Text>
              <View style={styles.folderGrid}>
                {ideaFolders.map((f) => (
                  <Card
                    key={f.id}
                    onPress={() => router.push(`/gimnasio?folderId=${f.id}`)}
                    style={[styles.folderTile, styles.gymTile]}
                  >
                    <Feather name="folder" size={22} color={textColors.violeta} />
                    <Text style={styles.folderName} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Pill
                      color={textColors.violeta}
                      label={`${deckCountByFolder[f.id]} ${deckCountByFolder[f.id] === 1 ? "mazo" : "mazos"}`}
                    />
                  </Card>
                ))}
              </View>
              <Text style={[type.label, { marginTop: spacing.sm }]}>Mazos</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState text="Todavía no hay ideas guardadas. Se crean desde el rayo ⚡ al repasar." />
        }
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/gimnasio/${item.id}`)} style={styles.row}>
            <Feather name={item.icon || "layers"} size={20} color={colors.accentText} />
            <View style={{ flex: 1 }}>
              <Text style={type.body} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={type.small}>
                Última idea: {new Date(item.last_idea_at).toLocaleDateString("es-AR")}
              </Text>
            </View>
            <Pill
              color={textColors.violeta}
              label={`${item.idea_count} ${item.idea_count === 1 ? "idea" : "ideas"}`}
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  folderGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  folderTile: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: spacing.sm,
  },
  gymTile: {
    borderColor: "rgba(158,110,222,0.25)",
    ...glow.violet,
  },
  folderName: {
    ...type.body,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
