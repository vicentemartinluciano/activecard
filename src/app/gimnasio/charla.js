import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import Toast from "../../components/Toast";
import { Card, EmptyState, Pill, Screen } from "../../components/ui";
import { listConnectionsByHybridCard } from "../../db/connections";
import { toPlainText } from "../../lib/richtext";
import { colors, font, spacing, type } from "../../theme";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VerCharla() {
  const { cardId } = useLocalSearchParams();
  const hybridCardId = Number(cardId);
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    listConnectionsByHybridCard(hybridCardId)
      .then((rows) => {
        if (!alive) return;
        setConnections(rows);
        setError("");
      })
      .catch(() => {
        if (alive) setError("No pudimos recuperar esta charla.");
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [hybridCardId]);

  if (!loaded) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Charla guardada" }} />
        <ActivityIndicator color={colors.accent} size="large" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Charla guardada" }} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        {connections.length === 0 ? (
          <EmptyState
            icon="message-circle"
            text="No encontramos la conversación de esta idea."
          />
        ) : (
          connections.map((connection) => (
            <View key={connection.id} style={{ gap: spacing.md }}>
              <Card
                level="high"
                onPress={
                  connection.card_id && connection.origin_deck_id
                    ? () =>
                        router.push(
                          `/mazos/${connection.origin_deck_id}/tarjeta?cardId=${connection.card_id}`
                        )
                    : undefined
                }
                style={{ gap: spacing.xs }}
              >
                <Text style={styles.eyebrow}>Esta idea nació de</Text>
                <Text style={styles.origin} numberOfLines={3}>
                  {connection.origin_front
                    ? toPlainText(connection.origin_front)
                    : "Tarjeta original"}
                </Text>
                {connection.origin_deck_name ? (
                  <Pill label={connection.origin_deck_name} />
                ) : null}
              </Card>

              <View style={{ gap: spacing.sm }}>
                <Text style={type.label}>Conversación</Text>
                {connection.transcript.length > 0 ? (
                  connection.transcript.map((message, index) => (
                    <View
                      key={`${connection.id}-${index}`}
                      style={[
                        styles.bubble,
                        message.role === "user" ? styles.userBubble : styles.auditorBubble,
                      ]}
                    >
                      <Text style={styles.role}>
                        {message.role === "user" ? "Vos" : "Socio"}
                      </Text>
                      <Text style={styles.message}>{message.text}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={type.small}>La conversación no quedó disponible.</Text>
                )}
              </View>

              <Card style={{ gap: spacing.xs }}>
                <Text style={styles.eyebrow}>Síntesis guardada</Text>
                <Text style={styles.message}>{connection.final_text}</Text>
                <Text style={styles.date}>{formatDate(connection.created_at)}</Text>
              </Card>
            </View>
          ))
        )}
      </ScrollView>
      <Toast message={error} onDismiss={() => setError("")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    ...type.small,
    ...font(700),
    color: colors.accentText,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  origin: {
    ...type.body,
    ...font(600),
  },
  bubble: {
    maxWidth: "90%",
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.xs,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.accentSoft,
  },
  auditorBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  role: {
    ...type.small,
    ...font(700),
    color: colors.accentText,
  },
  message: {
    ...type.body,
    fontSize: 15,
    lineHeight: 21,
  },
  date: {
    ...type.small,
    fontSize: 11,
    marginTop: spacing.xs,
  },
});
