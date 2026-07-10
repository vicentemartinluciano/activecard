import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button, Chip, Field, Screen } from "../../components/ui";
import { setDraft } from "../../lib/draftStore";
import { pickStudyFile } from "../../lib/files";
import { generateCardsFromPdf, generateCardsFromText } from "../../lib/generator";
import { fetchNotionPage } from "../../lib/notion";
import { colors, spacing, type } from "../../theme";

// Fuente de material → IA (opcional) → preselección.
export default function Crear() {
  const router = useRouter();
  const [mode, setMode] = useState("conceptos_clave");
  const [source, setSource] = useState("texto"); // 'texto' | 'archivo' | 'notion'
  const [text, setText] = useState("");
  const [notionUrl, setNotionUrl] = useState("");
  const [busy, setBusy] = useState(null); // string de estado o null
  const [error, setError] = useState(null);

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
      if (!text.trim()) return;
      setBusy("Claude está leyendo el material…");
      const cards = await generateCardsFromText(text, mode);
      goPreselect(cards, "texto pegado");
    });

  const generateFromFile = () =>
    run(async () => {
      const file = await pickStudyFile();
      if (!file) return;
      setBusy(`Claude está leyendo "${file.name}"…`);
      const cards =
        file.kind === "pdf"
          ? await generateCardsFromPdf(file.base64, mode)
          : await generateCardsFromText(file.text, mode);
      goPreselect(cards, file.name);
    });

  const generateFromNotion = () =>
    run(async () => {
      if (!notionUrl.trim()) return;
      setBusy("Leyendo la página de Notion…");
      const page = await fetchNotionPage(notionUrl);
      setBusy(`Claude está leyendo "${page.title}"…`);
      const cards = await generateCardsFromText(page.text, mode);
      goPreselect(cards, page.title);
    });

  if (busy) {
    return (
      <Screen style={styles.center}>
        <Stack.Screen options={{ title: "Crear tarjetas" }} />
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={[type.body, { textAlign: "center" }]}>{busy}</Text>
        <Text style={type.small}>Esto puede tardar un poco según el tamaño del material.</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: "Crear tarjetas" }} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={styles.section}>
          <Text style={type.small}>¿Cuánto extraer del material?</Text>
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
          </View>
        </View>

        <View style={styles.section}>
          <Text style={type.small}>Fuente del material</Text>
          <View style={styles.chipRow}>
            <Chip label="Texto" active={source === "texto"} onPress={() => setSource("texto")} />
            <Chip label="Archivo" active={source === "archivo"} onPress={() => setSource("archivo")} />
            <Chip label="Notion" active={source === "notion"} onPress={() => setSource("notion")} />
          </View>
        </View>

        {source === "texto" ? (
          <View style={styles.section}>
            <Field
              value={text}
              onChangeText={setText}
              placeholder="Pegá acá tus apuntes, un capítulo, ideas de un libro…"
              multiline
              style={{ minHeight: 200 }}
            />
            <Button
              label="Generar tarjetas con IA"
              kind="primary"
              onPress={generateFromText}
              disabled={!text.trim()}
            />
          </View>
        ) : null}

        {source === "archivo" ? (
          <View style={styles.section}>
            <Text style={type.small}>
              PDF, TXT o Markdown. En Android podés elegir archivos de Google Drive desde el
              selector (los Google Docs, exportalos a PDF primero).
            </Text>
            <Button label="Elegir archivo y generar" kind="primary" onPress={generateFromFile} />
          </View>
        ) : null}

        {source === "notion" ? (
          <View style={styles.section}>
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
              disabled={!notionUrl.trim()}
            />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={[styles.section, styles.manualSection]}>
          <Text style={type.small}>¿Sin IA? Creá tarjetas a mano dentro de cada mazo.</Text>
          <Button label="Ir a mis mazos" kind="ghost" onPress={() => router.push("/mazos")} />
        </View>
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
  error: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  manualSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
