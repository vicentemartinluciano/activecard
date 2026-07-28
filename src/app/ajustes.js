import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import Collapsible from "../components/Collapsible";
import PercentSlider from "../components/PercentSlider";
import Stagger from "../components/Stagger";
import { Button, Card, confirmAsync, Field, Screen } from "../components/ui";
import { listDecks, updateDeckPriority } from "../db/decks";
import { DEFAULT_LIMITS, getDailyLimits } from "../db/reviewQueue";
import { getSetting, setSetting } from "../db/settings";
import { getAnthropicKey, getNotionToken, setAnthropicKey, setNotionToken } from "../lib/keys";
import { exportBackup, pickBackupFile, restoreParsedBackup } from "../lib/backupIO";
import { spacing, type } from "../theme";

export default function Ajustes() {
  const router = useRouter();
  const [decks, setDecks] = useState([]);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [anthropicKey, setAnthropicKeyInput] = useState("");
  const [notionToken, setNotionTokenInput] = useState("");
  const [keysStatus, setKeysStatus] = useState(null);
  const [backupStatus, setBackupStatus] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [userName, setUserName] = useState("");
  const [nameStatus, setNameStatus] = useState(null);

  const load = useCallback(async () => {
    setDecks(await listDecks());
    setLimits(await getDailyLimits());
    setUserName(await getSetting("userName", "Martín"));
    if (Platform.OS === "web") {
      setAnthropicKeyInput(getAnthropicKey() || "");
      setNotionTokenInput(getNotionToken() || "");
    }
  }, []);

  const refresh = useCallback(() => {
    load();
  }, [load]);

  useFocusEffect(refresh);

  const changePriority = async (deckId, priority) => {
    await updateDeckPriority(deckId, priority);
    load();
  };

  const changeLimit = async (key, value) => {
    const next = { ...limits, [key]: value };
    setLimits(next); // optimista: el slider tiene que responder al toque
    await setSetting("dailyLimits", next);
  };

  const saveName = async () => {
    const clean = userName.trim();
    if (!clean) return;
    await setSetting("userName", clean);
    setNameStatus("Guardado ✓");
    setTimeout(() => setNameStatus(null), 2500);
  };

  const pausados = decks.filter((d) => d.priority === 0).length;

  const saveKeys = async () => {
    await setAnthropicKey(anthropicKey);
    await setNotionToken(notionToken);
    setKeysStatus("Guardadas ✓");
    setTimeout(() => setKeysStatus(null), 2500);
  };

  const doExport = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const name = await exportBackup();
      setBackupStatus(`Exportado: ${name}`);
    } catch (e) {
      setBackupStatus(`Error al exportar: ${e.message || e}`);
    } finally {
      setBackupBusy(false);
    }
  };

  const doImport = async () => {
    setBackupBusy(true);
    setBackupStatus(null);
    try {
      const picked = await pickBackupFile();
      if (!picked) return;
      const ok = await confirmAsync(
        "Importar respaldo",
        `Esto REEMPLAZA todos los datos actuales por los del archivo (${picked.decks} mazos, ${picked.cards} tarjetas). No se puede deshacer.`
      );
      if (!ok) return;
      const counts = await restoreParsedBackup(picked.parsed);
      setBackupStatus(`Importado: ${counts.decks} mazos, ${counts.cards} tarjetas.`);
      load();
    } catch (e) {
      setBackupStatus(`Error al importar: ${e.message || e}`);
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Ajustes" }} />
      <ScrollView contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }}>
        <Stagger style={{ marginBottom: 0 }}>
        <Collapsible
          icon="calendar"
          title="Carga diaria"
          summary={`${limits.maxReviews} repasos · ${limits.maxNew} nuevas`}
          defaultOpen
        >
          <View style={styles.limitItem}>
            <Text style={type.body}>Máximo de repasos por día</Text>
            <PercentSlider
              value={limits.maxReviews}
              min={5}
              max={100}
              step={5}
              formatLabel={(v) => `${v}`}
              onChange={(v) => changeLimit("maxReviews", v)}
            />
          </View>
          <View style={styles.limitItem}>
            <Text style={type.body}>Tarjetas nuevas por día</Text>
            <PercentSlider
              value={limits.maxNew}
              min={0}
              max={50}
              step={5}
              formatLabel={(v) => `${v}`}
              onChange={(v) => changeLimit("maxNew", v)}
            />
          </View>
          <Text style={type.small}>
            Lo que sobra pasa al día siguiente, empezando por los mazos de mayor prioridad. El
            tope de tarjetas nuevas protege las semanas que vienen: cada nueva que aceptás hoy
            vuelve mañana, en cuatro días y en dos semanas.
          </Text>
        </Collapsible>

        <Collapsible
          icon="sliders"
          title="Prioridad de los mazos"
          summary={
            decks.length === 0
              ? "Todavía no hay mazos"
              : `${decks.length} ${decks.length === 1 ? "mazo" : "mazos"}${
                  pausados > 0 ? ` · ${pausados} en pausa` : ""
                }`
          }
        >
          <Text style={type.small}>
            El porcentaje define cuánta presencia tiene cada mazo en el repaso diario. 0% lo
            pausa (no aparece hasta que lo subas; igual podés estudiarlo desde la Biblioteca).
          </Text>
          {decks.map((d) => (
            <View key={d.id} style={styles.priorityItem}>
              <Text style={type.body}>{d.name}</Text>
              <PercentSlider value={d.priority} onChange={(p) => changePriority(d.id, p)} />
            </View>
          ))}
        </Collapsible>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Respaldo</Text>
          <Text style={type.small}>
            Exportá un archivo con todos tus mazos, tarjetas y conexiones. Sirve como backup y
            para pasar datos entre el celular y la versión web (no se sincronizan solos).
          </Text>
          <Button
            label={backupBusy ? "Un momento…" : "Exportar datos"}
            onPress={doExport}
            disabled={backupBusy}
          />
          <Button
            label={backupBusy ? "Un momento…" : "Importar datos"}
            kind="danger"
            onPress={doImport}
            disabled={backupBusy}
          />
          {backupStatus ? <Text style={type.small}>{backupStatus}</Text> : null}
        </Card>

        {Platform.OS === "web" ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Claves de API</Text>
            <Text style={type.small}>
              En la web pública las claves no vienen incluidas por seguridad: pegalas acá una
              vez y quedan guardadas solo en este navegador.
            </Text>
            <Text style={type.small}>Clave de Anthropic (Claude)</Text>
            <Field
              value={anthropicKey}
              onChangeText={setAnthropicKeyInput}
              placeholder="sk-ant-…"
              autoCapitalize="none"
              secureTextEntry
            />
            <Text style={type.small}>Token de Notion</Text>
            <Field
              value={notionToken}
              onChangeText={setNotionTokenInput}
              placeholder="ntn_…"
              autoCapitalize="none"
              secureTextEntry
            />
            <Button label="Guardar claves" kind="primary" onPress={saveKeys} />
            {keysStatus ? <Text style={type.small}>{keysStatus}</Text> : null}
          </Card>
        ) : null}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Tu nombre</Text>
          <Text style={type.small}>Con esto te saluda la pantalla de Inicio.</Text>
          <View style={styles.nameRow}>
            <Field
              value={userName}
              onChangeText={setUserName}
              placeholder="Tu nombre"
              style={{ flex: 1 }}
            />
            <Button label="Guardar" kind="primary" onPress={saveName} />
          </View>
          {nameStatus ? <Text style={type.small}>{nameStatus}</Text> : null}
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Gimnasio Mental</Text>
          <Button label="Ver mis ideas" onPress={() => router.push("/gimnasio")} />
        </Card>
        </Stagger>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    ...type.label,
  },
  priorityItem: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  limitItem: {
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
});
