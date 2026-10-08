import Feather from "@expo/vector-icons/Feather";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Card, confirmAsync, EmptyState, Screen } from "../../components/ui";
import BrainMark from '../../components/BrainMark';
import { deleteGymChat, listGymChats } from "../../db/gymChats";
import { colors, font, spacing, type } from "../../theme";

const formatDate = (value) => new Date(value).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function HistorialGimnasio() {
  const router = useRouter();
  const [chats, setChats] = useState([]);
  const refresh = useCallback(() => {
    let alive = true;
    listGymChats().then((rows) => alive && setChats(rows)).catch(() => alive && setChats([]));
    return () => { alive = false; };
  }, []);
  useFocusEffect(refresh);

  const remove = async (chat) => {
    const ok = await confirmAsync("Borrar esta charla", "Se eliminarán sus mensajes, pero no las tarjetas que ya hayas creado.");
    if (!ok) return;
    await deleteGymChat(chat.id);
    setChats((current) => current.filter((item) => item.id !== chat.id));
  };

  return (
    <Screen style={Platform.OS === 'web' ? { maxWidth: 880, padding: 24 } : undefined}>
      <Stack.Screen options={{ title: "Charlas", headerShown: false }} />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver al Gimnasio" onPress={() => router.back()} style={styles.headerButton}>
          <Feather name="arrow-left" size={23} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><BrainMark size={26} /><Text style={styles.headerTitle}>Gimnasio</Text></View>
          <Text style={styles.subtitle}>Historial de conversaciones</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Nueva conversación" onPress={() => router.push('/gimnasio/chat')} style={styles.headerButton}>
          <Feather name="edit-3" size={20} color={colors.text} />
        </Pressable>
      </View>
      <FlatList
        data={chats}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}
        ListEmptyComponent={<EmptyState icon="message-circle" text="Todavía no hay conversaciones guardadas." />}
        renderItem={({ item }) => (
          <Card level="high" onPress={() => router.push(`/gimnasio/chat?id=${item.id}`)} style={styles.row}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={type.small} numberOfLines={2}>{item.last_message || item.draft_text || item.origin_front || "Charla sin mensajes"}</Text>
              <Text style={styles.date}>{formatDate(item.updated_at)}</Text>
            </View>
            <Pressable
              onPress={(event) => {
                event.stopPropagation();
                remove(item);
              }}
              hitSlop={10}
              style={styles.trash}
            >
              <Feather name="trash-2" size={17} color={colors.textMuted} />
            </Pressable>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  headerTitle: { ...type.heading, fontSize: 23 },
  subtitle: { ...type.small, fontSize: 11 },
  row: { minHeight: 78, padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...type.body, ...font(600) },
  date: { ...type.small, fontSize: 11 },
  trash: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
