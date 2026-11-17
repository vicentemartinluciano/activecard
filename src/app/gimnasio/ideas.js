// Gimnasio Mental: vista derivada de las tarjetas-idea (cards source='hybrid').
// Espejo de la Biblioteca — carpetas con ideas arriba + TODOS los mazos con
// ideas abajo (sueltos primero). La idea vive UNA sola vez, en su mazo; acá
// solo se la muestra desde otro ángulo. Con ?folderId=N filtra a esa carpeta.

import Feather from "@expo/vector-icons/Feather";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import BrainMark from "../../components/BrainMark";
import GlowPressable from "../../components/GlowPressable";
import { StaggerRow, useStaggerKey } from "../../components/Stagger";
import Toast from "../../components/Toast";
import { Card, EmptyState, Pill, Screen } from "../../components/ui";
import { listDecksWithIdeas } from "../../db/cards";
import { listFolders } from "../../db/folders";
import { colors, font, glow, HALO_PADDING, radius, spacing, textColors, type } from "../../theme";

export default function GimnasioMental() {
  const router = useRouter();
  const { folderId } = useLocalSearchParams();
  const folderFilter = folderId != null ? Number(folderId) : null;
  const [decks, setDecks] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loadError, setLoadError] = useState("");
  // Re-dispara la entrada escalonada cada vez que se vuelve a esta pantalla.
  const staggerKey = useStaggerKey();

  const refresh = useCallback(() => {
    let alive = true;
    Promise.all([listDecksWithIdeas(), listFolders()])
      .then(([d, f]) => {
        if (!alive) return;
        setDecks(d);
        setFolders(f);
        setLoadError("");
      })
      .catch(() => {
        if (!alive) return;
        setLoadError("No pudimos cargar el Gimnasio Mental.");
      });
    return () => {
      alive = false;
    };
  }, []);

  useFocusEffect(refresh);

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
    <Screen safeTop style={Platform.OS === "web" ? { maxWidth: 880, padding: 24 } : undefined}>
      <Stack.Screen options={{ title: activeFolder ? activeFolder.name : "Ideas", headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al Gimnasio"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/gimnasio"))}
          style={styles.headerButton}
        >
          <Feather name="arrow-left" size={23} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <BrainMark size={26} />
            <Text style={styles.headerTitle}>Gimnasio</Text>
          </View>
          <Text style={styles.subtitle} numberOfLines={1}>
            {activeFolder ? `Ideas · ${activeFolder.name}` : "Ideas guardadas"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Historial de conversaciones"
          onPress={() => router.push("/gimnasio/historial")}
          style={styles.iconButton}
        >
          <Feather name="clock" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Nueva conversación"
          onPress={() => router.push("/gimnasio/chat")}
          style={styles.iconButton}
        >
          <Feather name="edit-3" size={20} color={colors.text} />
        </Pressable>
      </View>
      <FlatList
        data={visibleDecks}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md, paddingBottom: spacing.xl }}
        ListHeaderComponent={
          showFolderGrid ? (
            <View style={{ gap: spacing.sm, marginBottom: spacing.xs }}>
              <Text style={type.label}>Carpetas</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.folderRow}
              >
                {ideaFolders.map((f) => (
                  <GlowPressable
                    key={f.id}
                    onPress={() => router.push(`/gimnasio/ideas?folderId=${f.id}`)}
                    halo={glow.haloViolet}
                    style={[styles.tileSurface, styles.folderTile, styles.gymTile]}
                  >
                    <Feather name="folder" size={22} color={textColors.violeta} />
                    <Text style={styles.folderName} numberOfLines={1}>
                      {f.name}
                    </Text>
                    <Pill
                      color={textColors.violeta}
                      label={`${deckCountByFolder[f.id]} ${deckCountByFolder[f.id] === 1 ? "mazo" : "mazos"}`}
                    />
                  </GlowPressable>
                ))}
              </ScrollView>
              <Text style={[type.label, { marginTop: spacing.sm }]}>Mazos</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState text="Todavía no hay ideas guardadas. Se crean desde el rayo ⚡ al repasar." />
        }
        renderItem={({ item, index }) => (
          <StaggerRow index={index} refreshKey={staggerKey}>
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
          </StaggerRow>
        )}
      />
      <Toast
        message={loadError}
        onRetry={() => {
          setLoadError("");
          refresh();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerTitle: {
    ...type.heading,
    fontSize: 22,
  },
  subtitle: {
    ...type.small,
    fontSize: 13,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(21,21,24,0.7)",
  },
  folderRow: {
    gap: spacing.sm,
    // Aire para que el halo del tile no se recorte contra el borde del carril
    // (ver HALO_PADDING en el theme). El margen negativo lo devuelve al layout.
    padding: HALO_PADDING,
    margin: -HALO_PADDING,
    paddingRight: HALO_PADDING + spacing.md,
  },
  folderTile: {
    width: 150,
    gap: spacing.sm,
  },
  tileSurface: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
  },
  gymTile: {
    borderColor: "rgba(158,110,222,0.25)",
  },
  folderName: {
    ...type.body,
    ...font(600),
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
