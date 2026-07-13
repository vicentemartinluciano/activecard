import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Card, Chip, Field, Screen } from "../../components/ui";
import { setDraft } from "../../lib/draftStore";
import { pickStudyFile } from "../../lib/files";
import { generateCardsFromPdf, generateCardsFromText } from "../../lib/generator";
import { fetchNotionPage } from "../../lib/notion";
import { colors, radius, spacing, type } from "../../theme";

const SOURCES = [
  { key: "texto", label: "Texto", icon: "type" },
  { key: "archivo", label: "Archivo", icon: "file" },
  { key: "notion", label: "Notion", icon: "globe" },
];

// Fuente de material → IA (opcional) → preselección.
export default function CrearConIA() {
  const router = useRouter();
  const [mode, setMode] = useState("conceptos_clave");
  const [source, setSource] = useState("texto"); // 'texto' | 'archivo' | 'notion'
  const [text, setText] = useState("");
  const [notionUrl, setNotionUrl] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [busy, setBusy] = useState(null); // string de estado o null
  const [error, setError] = useState(null);

  const customReady = mode !== "personalizado" || customInstruction.trim().length > 0;

  const run = async (fn) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(null);
    }
  };

  const goPreselect = (cards, label) => {
    setDraft(cards, label);
    router.push("/crear/preseleccion");
  };

  const generateFromText = () =>
    run(async () => {
      if (!text.trim() || !customReady) return;
      setBusy("Claude está leyendo el material…");
      const cards = await generateCardsFromText(text, mode, customInstruction);
      goPreselect(cards, "texto pegado");
    });

  const generateFromFile = () =>
    run(async () => {
      if (!customReady) return;
      const file = await pickStudyFile();
      if (!file) return;
      setBusy(`Claude está leyendo "${file.name}"…`);
      const cards =
        file.kind === "pdf"
          ? await generateCardsFromPdf(file.base64, mode, customInstruction)
          : await generateCardsFromText(file.text, mode, customInstruction);
      goPreselect(cards, file.name);
    });

  const generateFromNotion = () =>
    run(async () => {
      if (!notionUrl.trim() || !customReady) return;
      setBusy("Leyendo la página de Notion…");
      const page = await fetchNotionPage(notionUrl);
      setBusy(`Claude está leyendo "${page.title}"…`);
      const cards = await generateCardsFromText(page.text, mode, customInstruction);
      goPreselect(cards, page.title);
    });

  if (busy) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Generar con IA" }} />
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[type.body, { textAlign: "center" }]}>{busy}</Text>
        <Text style={type.small}>Esto puede tardar un poco según el tamaño del material.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Generar con IA" }} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <Card style={{ gap: spacing.md }}>
          <View style={styles.section}>
            <Text style={type.label}>¿Qué extraer del material?</Text>
            <View style={styles.chipRow}>
              <Chip
                label="Solo conceptos clave"
                active={mode === "conceptos_clave"}
                onPress={() => setMode("conceptos_clave")}
              />
              <Chip
                label="Creación completa"
                active={mode === "completo"}
                onPress={() => setMode("completo")}
              />
              <Chip
                label="Personalizado"
                active={mode === "personalizado"}
                onPress={() => setMode("personalizado")}
              />
            </View>
            {mode === "personalizado" ? (
              <Field
                value={customInstruction}
                onChangeText={setCustomInstruction}
                placeholder="Ej: extraé solo fechas y nombres propios, en tarjetas cortas…"
                multiline
                style={{ minHeight: 80 }}
              />
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={type.label}>Fuente del material</Text>
            <View style={styles.sourceRow}>
              {SOURCES.map((s) => {
                const active = source === s.key;
                return (
                  <Pressable
                    key={s.key}
                    onPress={() => setSource(s.key)}
                    style={({ pressed }) => [
                      styles.sourceTile,
                      active && styles.sourceTileActive,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Feather
                      name={s.icon}
                      size={22}
                      color={active ? colors.accentText : colors.textMuted}
                    />
                    <Text style={[styles.sourceLabel, active && { color: colors.accentText }]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        {source === "texto" ? (
          <Card style={styles.section}>
            <Field
              value={text}
              onChangeText={setText}
              placeholder="Pegá acá tus apuntes, un capítulo, ideas de un libro…"
              multiline
              style={{ minHeight: 220 }}
            />
            <Button
              label="Generar tarjetas con IA"
              kind="primary"
              onPress={generateFromText}
              disabled={!text.trim() || !customReady}
            />
          </Card>
        ) : null}

        {source === "archivo" ? (
          <Card style={styles.section}>
            <Text style={type.small}>
              PDF, TXT o Markdown. En Android podés elegir archivos de Google Drive desde el
              selector (los Google Docs, exportalos a PDF primero).
            </Text>
            <Button
              label="Elegir archivo y generar"
              kind="primary"
              onPress={generateFromFile}
              disabled={!customReady}
            />
          </Card>
        ) : null}

        {source === "notion" ? (
          <Card style={styles.section}>
            <Field
              value={notionUrl}
              onChangeText={setNotionUrl}
              placeholder="Pegá el enlace de la página de Notion…"
              autoCapitalize="none"
            />
            <Text style={type.small}>
              La página tiene que estar compartida con tu integración (menú ··· → Connections).
            </Text>
            <Button
              label="Leer página y generar"
              kind="primary"
              onPress={generateFromNotion}
              disabled={!notionUrl.trim() || !customReady}
            />
          </Card>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  section: {
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sourceRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sourceTile: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surfaceHigh,
  },
  sourceTileActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  sourceLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
